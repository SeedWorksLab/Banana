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
];
