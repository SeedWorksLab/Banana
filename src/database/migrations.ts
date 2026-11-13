import type { SQLiteDatabase } from 'expo-sqlite';

import { SCHEMA_SQL, SEED_STORES_SQL, storesTableSql } from './schema';

export interface Migration {
  id: number;
  description: string;
  sql: string;
  apply?: (db: SQLiteDatabase) => Promise<void>;
}

async function ensureColumn(
  db: SQLiteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.length === 0 || columns.some((existing) => existing.name === column)) {
    return;
  }
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    description: 'Initial schema',
    sql: `
${SCHEMA_SQL}

${SEED_STORES_SQL}
`,
  },
  {
    id: 2,
    description: 'Keep the raw scraped line on deals so a bad parse is auditable',
    sql: `ALTER TABLE deals ADD COLUMN raw_text TEXT;`,
  },
  {
    id: 3,
    description: 'Let each day override how many people are eating',
    sql: `ALTER TABLE week_day_budgets ADD COLUMN servings INTEGER;`,
  },
  {
    id: 4,
    description: 'Mark a slot as a wish so replanning keeps it',
    sql: `ALTER TABLE slots ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;`,
  },
  {
    id: 5,
    description: 'Restore the unit column on databases created before it was added',
    sql: '',
    apply: async (db) => {
      await ensureColumn(db, 'deals', 'unit', 'TEXT');
      await ensureColumn(db, 'shopping_items', 'unit', "TEXT NOT NULL DEFAULT 'piece'");
      await ensureColumn(db, 'pantry', 'unit', 'TEXT');
      await ensureColumn(db, 'recipe_ingredients', 'unit', "TEXT NOT NULL DEFAULT 'piece'");
      await ensureColumn(db, 'ingredients', 'default_unit', "TEXT NOT NULL DEFAULT 'piece'");
    },
  },
  {
    id: 6,
    description: 'Add country and currency to stores and currency to deals',
    sql: '',
    apply: async (db) => {
      await ensureColumn(db, 'stores', 'country', "TEXT NOT NULL DEFAULT 'AT'");
      await ensureColumn(db, 'stores', 'currency', "TEXT NOT NULL DEFAULT 'EUR'");
      await ensureColumn(db, 'deals', 'currency', "TEXT NOT NULL DEFAULT 'EUR'");
      await db.execAsync(`
DROP TABLE IF EXISTS stores_new;
${storesTableSql('stores_new', false)}
INSERT INTO stores_new
  (id, uuid, store_id, name, country, currency, offers_url, enabled, last_scraped_at,
   active, sort_order, created_at, updated_at, deleted)
SELECT
  id, uuid, store_id, name, country, currency, offers_url, enabled, last_scraped_at,
  active, sort_order, created_at, updated_at, deleted
FROM stores;
DROP TABLE stores;
ALTER TABLE stores_new RENAME TO stores;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_uuid ON stores (uuid);
${SEED_STORES_SQL}
`);
    },
  },
  {
    id: 7,
    description: 'Multiple homes, per-home pantry, expiry, wish recipes and sale-only items',
    sql: `
CREATE TABLE IF NOT EXISTS homes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_homes_uuid ON homes (uuid);

INSERT INTO homes (uuid, name, sort_order)
SELECT 'home-default', 'Home', 0
WHERE NOT EXISTS (SELECT 1 FROM homes);

ALTER TABLE week_day_budgets ADD COLUMN home_id INTEGER;
ALTER TABLE ingredients ADD COLUMN shelf_life_days INTEGER;
ALTER TABLE recipes ADD COLUMN is_wish INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shopping_items ADD COLUMN sale_only INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shopping_items ADD COLUMN home_id INTEGER;

DROP TABLE IF EXISTS pantry_new;
CREATE TABLE pantry_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  ingredient_id INTEGER NOT NULL,
  home_id INTEGER NOT NULL,
  level TEXT NOT NULL DEFAULT 'stocked' CHECK (level IN ('stocked','low','out')),
  quantity REAL,
  unit TEXT CHECK (unit IS NULL OR unit IN ('g','kg','ml','l','piece','tbsp','tsp','pinch','clove','slice','can','pack','bunch','to_taste')),
  expires_on TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE,
  FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE
);

INSERT INTO pantry_new
  (id, uuid, ingredient_id, home_id, level, quantity, unit, created_at, updated_at, deleted)
SELECT
  id, uuid, ingredient_id, (SELECT id FROM homes ORDER BY id LIMIT 1), level, quantity, unit,
  created_at, updated_at, deleted
FROM pantry;

DROP TABLE pantry;
ALTER TABLE pantry_new RENAME TO pantry;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pantry_uuid ON pantry (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pantry_ingredient_home ON pantry (ingredient_id, home_id);
CREATE INDEX IF NOT EXISTS idx_pantry_home ON pantry (home_id, deleted);

DROP TABLE IF EXISTS ai_runs_new;
CREATE TABLE ai_runs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  week_id INTEGER,
  kind TEXT NOT NULL CHECK (kind IN ('plan_proposal','gap_fill','narrative','plan_edit','recipe_extract','newspaper')),
  prompt_id TEXT,
  prompt_version TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  request_summary TEXT,
  response_json TEXT,
  error TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_estimate_cents INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  FOREIGN KEY (week_id) REFERENCES weeks (id) ON DELETE SET NULL
);

INSERT INTO ai_runs_new
  (id, uuid, week_id, kind, prompt_id, prompt_version, model, status, request_summary,
   response_json, error, input_tokens, output_tokens, cost_estimate_cents, created_at, updated_at)
SELECT
  id, uuid, week_id, kind, prompt_id, prompt_version, model, status, request_summary,
  response_json, error, input_tokens, output_tokens, cost_estimate_cents, created_at, updated_at
FROM ai_runs;

DROP TABLE ai_runs;
ALTER TABLE ai_runs_new RENAME TO ai_runs;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_runs_uuid ON ai_runs (uuid);
CREATE INDEX IF NOT EXISTS idx_ai_runs_week ON ai_runs (week_id, created_at);
`,
  },
];
