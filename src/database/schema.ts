import {
  AI_RUN_KINDS,
  AI_RUN_STATUSES,
  COUNTRIES,
  CURRENCIES,
  DIETS,
  INGREDIENT_CATEGORIES,
  MATCH_STATUSES,
  MEAL_TYPES,
  PANTRY_LEVELS,
  RECIPE_SOURCES,
  SCRAPE_RUN_STATUSES,
  SLOT_EVENT_KINDS,
  SLOT_KINDS,
  STORE_COUNTRIES,
  STORE_CURRENCIES,
  STORE_IDS,
  UNITS,
  WEEK_DAYS,
  WEEK_STATUSES,
  DAY_MODES,
} from '../models';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

const quoted = (values: readonly string[]): string => values.map((v) => `'${v}'`).join(',');

const enumCheck = (column: string, values: readonly string[]): string =>
  `CHECK (${column} IS NULL OR ${column} IN (${quoted(values)}))`;

const DAY_CHECK = enumCheck('day', WEEK_DAYS);
const MEAL_TYPE_CHECK = enumCheck('meal_type', MEAL_TYPES);
const UNIT_CHECK = enumCheck('unit', UNITS);
const CATEGORY_CHECK = enumCheck('category', INGREDIENT_CATEGORIES);
const RECIPE_CATEGORY_CHECK = enumCheck('category', MEAL_TYPES);
const COUNTRY_CHECK = enumCheck('country', COUNTRIES);
const CURRENCY_CHECK = enumCheck('currency', CURRENCIES);

export function storesTableSql(table = 'stores', includeIndex = true): string {
  return `
CREATE TABLE IF NOT EXISTS ${table} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  store_id TEXT NOT NULL UNIQUE CHECK (store_id IN (${quoted(STORE_IDS)})),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'AT' ${COUNTRY_CHECK},
  currency TEXT NOT NULL DEFAULT 'EUR' ${CURRENCY_CHECK},
  offers_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  last_scraped_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);
${
  includeIndex
    ? `\nCREATE UNIQUE INDEX IF NOT EXISTS idx_stores_uuid ON ${table} (uuid);\n`
    : ''
}`;
}

export const SCHEMA_SQL = `
-- Configuration -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ai_state (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  llm_base_url TEXT,
  llm_api_key TEXT,
  llm_model TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS preferences (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  diet TEXT NOT NULL DEFAULT 'omnivore' CHECK (diet IN (${quoted(DIETS)})),
  allergies TEXT NOT NULL DEFAULT '[]',
  dislikes TEXT NOT NULL DEFAULT '[]',
  default_servings INTEGER NOT NULL DEFAULT 2,
  max_minutes_weeknight INTEGER NOT NULL DEFAULT 30,
  max_minutes_weekend INTEGER NOT NULL DEFAULT 60,
  weekly_budget_cents INTEGER NOT NULL DEFAULT 8000,
  household_name TEXT,
  updated_at TEXT
);

-- Catalogue -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' ${CATEGORY_CHECK},
  default_unit TEXT NOT NULL DEFAULT 'piece' ${enumCheck('default_unit', UNITS)},
  default_quantity REAL,
  is_pantry_staple INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_uuid ON ingredients (uuid);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients (name);
CREATE INDEX IF NOT EXISTS idx_ingredients_active ON ingredients (active, deleted);

CREATE TABLE IF NOT EXISTS ingredient_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  ingredient_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_aliases_uuid ON ingredient_aliases (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_aliases_alias ON ingredient_aliases (alias);
CREATE INDEX IF NOT EXISTS idx_ingredient_aliases_ingredient ON ingredient_aliases (ingredient_id);

${storesTableSql()}

-- Recipes -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'dinner' ${RECIPE_CATEGORY_CHECK},
  source TEXT NOT NULL DEFAULT 'own' CHECK (source IN (${quoted(RECIPE_SOURCES)})),
  is_builtin INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  servings INTEGER NOT NULL DEFAULT 2,
  prep_minutes INTEGER NOT NULL DEFAULT 0,
  cook_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_uuid ON recipes (uuid);
CREATE INDEX IF NOT EXISTS idx_recipes_active ON recipes (active, deleted);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes (category);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  recipe_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL ${UNIT_CHECK},
  note TEXT,
  optional INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_ingredients_uuid ON recipe_ingredients (uuid);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients (recipe_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients (ingredient_id);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  recipe_id INTEGER NOT NULL,
  step_index INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  duration_minutes INTEGER,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_steps_uuid ON recipe_steps (uuid);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe ON recipe_steps (recipe_id, step_index);

CREATE TABLE IF NOT EXISTS recipe_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  recipe_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_tags_uuid ON recipe_tags (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_tags_unique ON recipe_tags (recipe_id, tag);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag ON recipe_tags (tag);

-- Pantry --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pantry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  ingredient_id INTEGER NOT NULL,
  level TEXT NOT NULL DEFAULT 'stocked' CHECK (level IN (${quoted(PANTRY_LEVELS)})),
  quantity REAL,
  unit TEXT ${UNIT_CHECK},
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pantry_uuid ON pantry (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pantry_ingredient ON pantry (ingredient_id);

-- Weeks, days and slots -----------------------------------------------------

CREATE TABLE IF NOT EXISTS weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  week_start_date TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN (${quoted(WEEK_STATUSES)})),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weeks_uuid ON weeks (uuid);

CREATE TABLE IF NOT EXISTS week_day_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  week_id INTEGER NOT NULL,
  day TEXT NOT NULL ${DAY_CHECK},
  mode TEXT NOT NULL DEFAULT 'cook' CHECK (mode IN (${quoted(DAY_MODES)})),
  cook_minutes INTEGER NOT NULL DEFAULT 45,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  FOREIGN KEY (week_id) REFERENCES weeks (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_week_day_budgets_uuid ON week_day_budgets (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_week_day_budgets_unique ON week_day_budgets (week_id, day);

CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  week_id INTEGER NOT NULL,
  day TEXT NOT NULL ${DAY_CHECK},
  meal_type TEXT NOT NULL ${MEAL_TYPE_CHECK},
  kind TEXT NOT NULL DEFAULT 'empty' CHECK (kind IN (${quoted(SLOT_KINDS)})),
  recipe_id INTEGER,
  free_text TEXT,
  servings INTEGER NOT NULL DEFAULT 2,
  note TEXT,
  cooked_at TEXT,
  rating INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (week_id) REFERENCES weeks (id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_uuid ON slots (uuid);
CREATE INDEX IF NOT EXISTS idx_slots_week ON slots (week_id, day, meal_type, sort_order);

CREATE TABLE IF NOT EXISTS slot_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  slot_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (${quoted(SLOT_EVENT_KINDS)})),
  field TEXT,
  previous_value TEXT,
  new_value TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  FOREIGN KEY (slot_id) REFERENCES slots (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_events_uuid ON slot_events (uuid);
CREATE INDEX IF NOT EXISTS idx_slot_events_slot ON slot_events (slot_id, created_at);

-- Shopping list -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shopping_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  week_id INTEGER NOT NULL,
  ingredient_id INTEGER,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' ${CATEGORY_CHECK},
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL ${UNIT_CHECK},
  checked INTEGER NOT NULL DEFAULT 0,
  manual INTEGER NOT NULL DEFAULT 0,
  deal_id INTEGER,
  price_cents INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (week_id) REFERENCES weeks (id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE SET NULL,
  FOREIGN KEY (deal_id) REFERENCES deals (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_items_uuid ON shopping_items (uuid);
CREATE INDEX IF NOT EXISTS idx_shopping_items_week ON shopping_items (week_id, category, sort_order);

-- Deals and the scraper -----------------------------------------------------

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  store_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  brand TEXT,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR' ${CURRENCY_CHECK},
  reference_price_cents INTEGER,
  unit TEXT,
  quantity_text TEXT,
  valid_from TEXT,
  valid_to TEXT,
  source_url TEXT,
  scraped_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_uuid ON deals (uuid);
CREATE INDEX IF NOT EXISTS idx_deals_store ON deals (store_id, scraped_at);
CREATE INDEX IF NOT EXISTS idx_deals_product ON deals (product_name);

CREATE TABLE IF NOT EXISTS deal_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  deal_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'auto' CHECK (status IN (${quoted(MATCH_STATUSES)})),
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  FOREIGN KEY (deal_id) REFERENCES deals (id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_matches_uuid ON deal_matches (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_matches_unique ON deal_matches (deal_id, ingredient_id);
CREATE INDEX IF NOT EXISTS idx_deal_matches_ingredient ON deal_matches (ingredient_id, status);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  store_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (${quoted(SCRAPE_RUN_STATUSES)})),
  deals_found INTEGER NOT NULL DEFAULT 0,
  deals_new INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scrape_runs_uuid ON scrape_runs (uuid);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_store ON scrape_runs (store_id, started_at);

-- AI runs -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  week_id INTEGER,
  kind TEXT NOT NULL CHECK (kind IN (${quoted(AI_RUN_KINDS)})),
  prompt_id TEXT,
  prompt_version TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (${quoted(AI_RUN_STATUSES)})),
  request_summary TEXT,
  response_json TEXT,
  error TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_estimate_cents INTEGER,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT,
  FOREIGN KEY (week_id) REFERENCES weeks (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_runs_uuid ON ai_runs (uuid);
CREATE INDEX IF NOT EXISTS idx_ai_runs_week ON ai_runs (week_id, created_at);
`;

const STORE_SEED: {
  uuid: string;
  storeId: (typeof STORE_IDS)[number];
  name: string;
  offersUrl: string;
  enabled: number;
  sortOrder: number;
}[] = [
  { uuid: 'store-lidl', storeId: 'lidl', name: 'Lidl', offersUrl: 'https://www.lidl.at/', enabled: 1, sortOrder: 1 },
  { uuid: 'store-hofer', storeId: 'hofer', name: 'Hofer', offersUrl: 'https://shop.hofer.at/sale', enabled: 1, sortOrder: 2 },
  { uuid: 'store-spar', storeId: 'spar', name: 'Spar', offersUrl: 'https://www.spar.at/aktionen', enabled: 0, sortOrder: 3 },
  { uuid: 'store-billa-at', storeId: 'billa_at', name: 'Billa', offersUrl: 'https://shop.billa.at/aktionen', enabled: 0, sortOrder: 4 },
  { uuid: 'store-dm-at', storeId: 'dm_at', name: 'dm', offersUrl: 'https://www.dm.at/', enabled: 0, sortOrder: 5 },
  { uuid: 'store-tedi-at', storeId: 'tedi_at', name: 'Tedi', offersUrl: 'https://www.tedi.com/at/', enabled: 0, sortOrder: 6 },
  { uuid: 'store-aldi-hu', storeId: 'aldi_hu', name: 'Aldi', offersUrl: 'https://www.aldi.hu/szuper-akciok-mindennap', enabled: 0, sortOrder: 7 },
  { uuid: 'store-lidl-hu', storeId: 'lidl_hu', name: 'Lidl', offersUrl: 'https://www.lidl.hu/', enabled: 0, sortOrder: 8 },
  { uuid: 'store-spar-hu', storeId: 'spar_hu', name: 'Spar', offersUrl: 'https://www.spar.hu/ajanlatok', enabled: 0, sortOrder: 9 },
];

export const SEED_STORES_SQL = `
INSERT OR IGNORE INTO stores
  (uuid, store_id, name, country, currency, offers_url, enabled, sort_order)
VALUES
${STORE_SEED.map(
  (store) =>
    `  ('${store.uuid}', '${store.storeId}', '${store.name.replace(/'/g, "''")}', '${STORE_COUNTRIES[store.storeId]}', '${STORE_CURRENCIES[store.storeId]}', '${store.offersUrl}', ${store.enabled}, ${store.sortOrder})`
).join(',\n')};
`;
