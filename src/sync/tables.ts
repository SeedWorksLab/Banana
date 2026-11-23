export interface SyncTable {
  name: string;
  columns: readonly string[];
  references?: Readonly<Record<string, string>>;
  booleans?: readonly string[];
  naturalKey?: readonly string[];
  onlyManual?: boolean;
}

export const SYNC_TABLES: readonly SyncTable[] = [
  { name: 'homes', columns: ['name', 'sort_order', 'deleted'] },
  { name: 'stores', columns: ['store_id', 'enabled'], booleans: ['enabled'], naturalKey: ['store_id'] },
  {
    name: 'preferences',
    columns: ['diet', 'allergies', 'dislikes', 'default_servings', 'max_minutes_weeknight',
      'max_minutes_weekend', 'weekly_budget_cents', 'household_name'],
    naturalKey: ['id'],
  },
  {
    name: 'ingredients',
    columns: ['name', 'category', 'default_unit', 'default_quantity', 'is_pantry_staple',
      'shelf_life_days', 'notes', 'active', 'sort_order', 'deleted'],
    booleans: ['is_pantry_staple', 'active', 'deleted'],
  },
  {
    name: 'ingredient_aliases',
    columns: ['ingredient_id', 'alias'],
    references: { ingredient_id: 'ingredients' },
  },
  {
    name: 'recipes',
    columns: ['name', 'description', 'category', 'source', 'is_builtin', 'is_favorite',
      'is_wish', 'servings', 'prep_minutes', 'cook_minutes', 'notes', 'active', 'sort_order', 'deleted'],
    booleans: ['is_builtin', 'is_favorite', 'is_wish', 'active', 'deleted'],
  },
  {
    name: 'recipe_ingredients',
    columns: ['recipe_id', 'ingredient_id', 'quantity', 'unit', 'note', 'optional', 'sort_order'],
    references: { recipe_id: 'recipes', ingredient_id: 'ingredients' },
    booleans: ['optional'],
  },
  {
    name: 'recipe_steps',
    columns: ['recipe_id', 'step_index', 'instruction', 'duration_minutes'],
    references: { recipe_id: 'recipes' },
  },
  {
    name: 'recipe_tags',
    columns: ['recipe_id', 'tag'],
    references: { recipe_id: 'recipes' },
    naturalKey: ['recipe_id', 'tag'],
  },
  {
    name: 'pantry',
    columns: ['ingredient_id', 'home_id', 'level', 'quantity', 'unit', 'expires_on', 'deleted'],
    references: { ingredient_id: 'ingredients', home_id: 'homes' },
    booleans: ['deleted'],
    naturalKey: ['ingredient_id', 'home_id'],
  },
  {
    name: 'weeks',
    columns: ['week_start_date', 'status', 'notes', 'deleted'],
    booleans: ['deleted'],
    naturalKey: ['week_start_date'],
  },
  {
    name: 'week_day_budgets',
    columns: ['week_id', 'day', 'mode', 'cook_minutes', 'servings', 'home_id', 'meal_settings'],
    references: { week_id: 'weeks', home_id: 'homes' },
    naturalKey: ['week_id', 'day'],
  },
  {
    name: 'slots',
    columns: ['week_id', 'day', 'meal_type', 'kind', 'recipe_id', 'free_text', 'servings',
      'note', 'pinned', 'cooked_at', 'rating', 'sort_order', 'deleted', 'batch_source_uuid'],
    references: { week_id: 'weeks', recipe_id: 'recipes' },
    booleans: ['pinned', 'deleted'],
  },
  {
    name: 'shopping_items',
    columns: ['week_id', 'home_id', 'ingredient_id', 'label', 'category', 'quantity',
      'unit', 'checked', 'manual', 'sale_only', 'sort_order', 'deleted'],
    references: { week_id: 'weeks', home_id: 'homes', ingredient_id: 'ingredients' },
    booleans: ['checked', 'manual', 'sale_only', 'deleted'],
    onlyManual: true,
  },
  {
    name: 'shopping_checks',
    columns: ['week_id', 'home_id', 'ingredient_id', 'unit', 'item_key', 'checked'],
    references: { week_id: 'weeks', home_id: 'homes', ingredient_id: 'ingredients' },
    booleans: ['checked'],
    naturalKey: ['item_key'],
  },
];

export const SYNC_SETTINGS_KEYS = [
  'language', 'theme_mode', 'currency', 'default_servings', 'default_weeknight_minutes',
  'default_weekend_minutes', 'dinner_only', 'plan_start_day', 'notifications_enabled',
  'shopping_reminder_hour', 'plan_reminder_day',
] as const;

export function syncTriggersSql(): string {
  const guard = "(SELECT COALESCE((SELECT value FROM sync_meta WHERE key = 'pull_in_progress'), '0') = '0')";
  const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  return SYNC_TABLES.map(({ name, onlyManual }) => {
    const includedNew = onlyManual ? ' AND NEW.manual = 1' : '';
    const includedOld = onlyManual ? ' AND OLD.manual = 1' : '';
    return `
CREATE TRIGGER IF NOT EXISTS trg_sync_${name}_insert AFTER INSERT ON ${name}
WHEN ${guard}${includedNew}
BEGIN
  UPDATE ${name} SET uuid = COALESCE(uuid, lower(hex(randomblob(16)))),
    updated_at = COALESCE(updated_at, ${now}) WHERE id = NEW.id;
  INSERT INTO sync_outbox (table_name, row_key)
    SELECT '${name}', uuid FROM ${name} WHERE id = NEW.id
    ON CONFLICT (table_name, row_key) DO UPDATE SET logged_at = ${now};
END;
CREATE TRIGGER IF NOT EXISTS trg_sync_${name}_update AFTER UPDATE ON ${name}
WHEN ${guard}${includedNew}
BEGIN
  UPDATE ${name} SET updated_at = ${now} WHERE id = NEW.id;
  INSERT INTO sync_outbox (table_name, row_key)
    SELECT '${name}', uuid FROM ${name} WHERE id = NEW.id
    ON CONFLICT (table_name, row_key) DO UPDATE SET logged_at = ${now};
END;
CREATE TRIGGER IF NOT EXISTS trg_sync_${name}_delete AFTER DELETE ON ${name}
WHEN ${guard}${includedOld}
BEGIN
  INSERT INTO sync_tombstones (table_name, row_key, deleted_at)
    VALUES ('${name}', OLD.uuid, ${now})
    ON CONFLICT (table_name, row_key) DO UPDATE SET deleted_at = excluded.deleted_at;
END;`;
  }).join('\n');
}
