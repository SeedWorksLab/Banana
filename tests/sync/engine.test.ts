import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { saveShoppingCheck, shoppingCheckKey } from '../../src/database/shoppingChecks';
import { getShoppingChecks } from '../../src/database/shoppingChecks';
import { getShoppingItems, setShoppingItemChecked } from '../../src/database/shoppingItems';
import { getSettings } from '../../src/database/settings';
import { updateSyncState } from '../../src/database/syncState';
import { syncNow } from '../../src/sync/engine';
import { SYNC_TABLES } from '../../src/sync/tables';
import type {
  RemoteRow, RemoteSetting, RemoteTombstone, SeedProfile, SyncTransport,
} from '../../src/sync/transport';

const USER = 'user-one';

function databaseFixture(): { db: SQLiteDatabase; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    runAsync: async (sql: string, params: readonly unknown[] = []) => {
      const result = sqlite.prepare(sql).run(...params as (string | number | null)[]);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: result.changes };
    },
    getFirstAsync: async (sql: string, params: readonly unknown[] = []) =>
      sqlite.prepare(sql).get(...params as (string | number | null)[]) ?? null,
    getAllAsync: async (sql: string, params: readonly unknown[] = []) =>
      sqlite.prepare(sql).all(...params as (string | number | null)[]),
    withTransactionAsync: async <T,>(fn: () => Promise<T>) => {
      sqlite.exec('BEGIN');
      try {
        const result = await fn();
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
  return { db, sqlite };
}

async function migrate(db: SQLiteDatabase): Promise<void> {
  for (const migration of MIGRATIONS) {
    await db.withTransactionAsync(async () => {
      if (migration.sql) await db.execAsync(migration.sql);
      await migration.apply?.(db, 0);
    });
  }
}

async function migrateThrough(db: SQLiteDatabase, version: number): Promise<void> {
  for (const migration of MIGRATIONS.filter((item) => item.id <= version)) {
    await db.withTransactionAsync(async () => {
      if (migration.sql) await db.execAsync(migration.sql);
      await migration.apply?.(db, 0);
    });
  }
}

function fakeTransport() {
  const rows = new Map(SYNC_TABLES.map((table) => [table.name, new Map<string, RemoteRow>()]));
  const settings = new Map<string, RemoteSetting>();
  const tombstones = new Map<string, RemoteTombstone>();
  const profile: SeedProfile = { display_name: 'Seed user', updated_at: '2025-01-01T00:00:00.000Z' };
  const reports: { records: number; bytes: number }[] = [];
  const transport: SyncTransport = {
    listRows: async (table) => [...(rows.get(table)?.values() ?? [])],
    upsertRow: async (table, row) => { rows.get(table)?.set(row.uuid, row); },
    deleteRow: async (table, uuid) => { rows.get(table)?.delete(uuid); },
    listSettings: async () => [...settings.values()],
    upsertSetting: async (_user, setting) => { settings.set(setting.key, setting); },
    listTombstones: async () => [...tombstones.values()],
    upsertTombstone: async (_user, row) => {
      tombstones.set(`${row.table_name}:${row.row_key}`, row);
    },
    deleteTombstone: async (_user, table, uuid) => {
      tombstones.delete(`${table}:${uuid}`);
    },
    getProfile: async () => profile,
    setProfile: async (_user, name) => { profile.display_name = name; },
    reportUsage: async (records, bytes) => { reports.push({ records, bytes }); },
  };
  return { transport, rows, settings, tombstones, profile, reports };
}

async function enabled(db: SQLiteDatabase): Promise<void> {
  await updateSyncState({ enabled: true }, db);
}

describe('SeedWorks sync with an in-memory SQLite database and fake transport', () => {
  let sqlite: DatabaseSync;
  let db: SQLiteDatabase;

  beforeEach(async () => {
    ({ db, sqlite } = databaseFixture());
    await migrate(db);
  });
  afterEach(() => sqlite.close());

  it('tracks manual edits and deletes, but never captures generated shopping rows', async () => {
    await db.runAsync("INSERT INTO ingredients (uuid, name) VALUES ('ingredient-1', 'Rice')");
    expect(await db.getFirstAsync<{ row_key: string }>(
      "SELECT row_key FROM sync_outbox WHERE table_name = 'ingredients'"
    )).toMatchObject({ row_key: 'ingredient-1' });
    await db.runAsync("DELETE FROM ingredients WHERE uuid = 'ingredient-1'");
    expect(await db.getFirstAsync<{ row_key: string }>(
      "SELECT row_key FROM sync_tombstones WHERE table_name = 'ingredients'"
    )).toMatchObject({ row_key: 'ingredient-1' });
    await db.runAsync("INSERT INTO weeks (uuid, week_start_date) VALUES ('week-1', '2025-01-06')");
    await db.runAsync(
      `INSERT INTO shopping_items (week_id, label, unit, manual)
       VALUES ((SELECT id FROM weeks WHERE uuid = 'week-1'), 'Bread', 'piece', 0)`
    );
    expect(await db.getFirstAsync(
      "SELECT row_key FROM sync_outbox WHERE table_name = 'shopping_items'"
    )).toBeNull();
  });

  it('pulls recipes with parent UUID references, account name, language, and reports usage', async () => {
    const cloud = fakeTransport();
    await enabled(db);
    cloud.rows.get('ingredients')?.set('remote-ingredient', {
      uuid: 'remote-ingredient', user_id: USER,
      payload: {
        name: 'Oats', category: 'other', default_unit: 'g', default_quantity: null,
        is_pantry_staple: false, shelf_life_days: null, notes: null, active: true,
        sort_order: 0, deleted: false,
      }, updated_at: '2025-01-01T00:00:00.000Z',
    });
    cloud.rows.get('recipes')?.set('remote-recipe', {
      uuid: 'remote-recipe', user_id: USER,
      payload: {
        name: 'Porridge', description: null, category: 'breakfast', source: 'own',
        is_builtin: false, is_favorite: false, is_wish: false, servings: 2,
        prep_minutes: 5, cook_minutes: 10, notes: null, active: true,
        sort_order: 0, deleted: false,
      }, updated_at: '2025-01-01T00:00:00.000Z',
    });
    cloud.rows.get('recipe_ingredients')?.set('remote-line', {
      uuid: 'remote-line', user_id: USER,
      payload: {
        recipe_uuid: 'remote-recipe', ingredient_uuid: 'remote-ingredient',
        quantity: 100, unit: 'g', note: null, optional: false, sort_order: 0,
      }, updated_at: '2025-01-01T00:00:00.000Z',
    });
    cloud.settings.set('language', {
      key: 'language', value: 'de', updated_at: '2025-01-01T00:00:00.000Z',
    });
    const result = await syncNow({ db, transport: cloud.transport, userId: USER });
    expect(result?.pulled).toBeGreaterThanOrEqual(3);
    expect((await getSettings(db)).language).toBe('de');
    expect((await getSettings(db)).username).toBe('Seed user');
    const line = await db.getFirstAsync<{ recipe_id: number; ingredient_id: number }>(
      "SELECT recipe_id, ingredient_id FROM recipe_ingredients WHERE uuid = 'remote-line'"
    );
    expect(line?.recipe_id).toBeGreaterThan(0);
    expect(line?.ingredient_id).toBeGreaterThan(0);
    expect(cloud.rows.get('recipe_ingredients')?.get('remote-line')?.payload)
      .not.toHaveProperty('recipe_id');
    expect(cloud.reports.at(-1)).toMatchObject({ records: expect.any(Number), bytes: expect.any(Number) });
    expect(cloud.reports.at(-1)?.records).toBeGreaterThan(0);
  });

  it('lets account preferences replace untouched local defaults on first sign-in', async () => {
    const cloud = fakeTransport();
    await enabled(db);
    await db.runAsync('INSERT INTO preferences (id) VALUES (1)');
    cloud.rows.get('preferences')?.set('cloud-preferences', {
      uuid: 'cloud-preferences', user_id: USER, updated_at: '2025-01-01T00:00:00.000Z',
      payload: {
        diet: 'vegetarian', allergies: '["nuts"]', dislikes: '[]',
        default_servings: 4, max_minutes_weeknight: 45, max_minutes_weekend: 90,
        weekly_budget_cents: 7000, household_name: 'Kitchen',
      },
    });
    await syncNow({ db, transport: cloud.transport, userId: USER });
    expect(await db.getFirstAsync(
      'SELECT uuid, diet, weekly_budget_cents FROM preferences WHERE id = 1'
    )).toMatchObject({
      uuid: 'cloud-preferences', diet: 'vegetarian', weekly_budget_cents: 7000,
    });
    expect(cloud.rows.get('preferences')?.size).toBe(1);
  });

  it('keeps a newer local edit over an older cloud copy', async () => {
    const cloud = fakeTransport();
    await enabled(db);
    await db.runAsync("INSERT INTO ingredients (uuid, name) VALUES ('rice', 'Local rice')");
    cloud.rows.get('ingredients')?.set('rice', {
      uuid: 'rice', user_id: USER, updated_at: '2025-01-01T00:00:00.000Z',
      payload: {
        name: 'Old rice', category: 'other', default_unit: 'piece',
        default_quantity: null, is_pantry_staple: false, shelf_life_days: null,
        notes: null, active: true, sort_order: 0, deleted: false,
      },
    });
    await syncNow({ db, transport: cloud.transport, userId: USER });
    expect(await db.getFirstAsync(
      "SELECT name FROM ingredients WHERE uuid = 'rice'"
    )).toMatchObject({ name: 'Local rice' });
    expect(cloud.rows.get('ingredients')?.get('rice')?.payload.name).toBe('Local rice');
  });

  it('keeps hard deletions from being resurrected by stale remote rows', async () => {
    const cloud = fakeTransport();
    await enabled(db);
    await db.runAsync("INSERT INTO ingredients (uuid, name) VALUES ('removed-ingredient', 'Rice')");
    await db.runAsync("DELETE FROM ingredients WHERE uuid = 'removed-ingredient'");
    cloud.rows.get('ingredients')?.set('removed-ingredient', {
      uuid: 'removed-ingredient', user_id: USER, updated_at: '2024-01-01T00:00:00.000Z',
      payload: { name: 'Rice' },
    });
    await syncNow({ db, transport: cloud.transport, userId: USER });
    expect(cloud.rows.get('ingredients')?.has('removed-ingredient')).toBe(false);
    expect(cloud.tombstones.has('ingredients:removed-ingredient')).toBe(true);
    expect(await db.getFirstAsync(
      "SELECT id FROM ingredients WHERE uuid = 'removed-ingredient'"
    )).toBeNull();
  });

  it('pushes only whitelisted personal fields, never device IDs or private caches', async () => {
    const cloud = fakeTransport();
    await enabled(db);
    await db.runAsync("INSERT INTO ingredients (uuid, name) VALUES ('rice', 'Rice')");
    await db.runAsync(
      `INSERT INTO recipes (uuid, name, category) VALUES ('dinner', 'Rice bowl', 'dinner')`
    );
    await db.runAsync(
      `INSERT INTO recipe_ingredients (uuid, recipe_id, ingredient_id, quantity, unit)
       VALUES ('line', (SELECT id FROM recipes WHERE uuid = 'dinner'),
               (SELECT id FROM ingredients WHERE uuid = 'rice'), 250, 'g')`
    );
    await db.runAsync(
      "INSERT INTO ai_state (id, llm_api_key) VALUES (1, 'private-ai-secret')"
    );
    await db.runAsync(
      "INSERT INTO settings (key, value, updated_at) VALUES ('username', 'Banana cook', '2099-01-01T00:00:00.000Z')"
    );
    await db.runAsync(
      "INSERT INTO settings (key, value) VALUES ('tutorial_seen', '1')"
    );
    await syncNow({ db, transport: cloud.transport, userId: USER });
    const line = cloud.rows.get('recipe_ingredients')?.get('line')?.payload;
    expect(line).toMatchObject({
      recipe_uuid: 'dinner', ingredient_uuid: 'rice', quantity: 250, unit: 'g',
    });
    expect(line).not.toHaveProperty('recipe_id');
    expect(line).not.toHaveProperty('ingredient_id');
    expect(cloud.profile.display_name).toBe('Banana cook');
    expect(cloud.settings.has('tutorial_seen')).toBe(false);
    expect(JSON.stringify([...cloud.rows.values()].map((table) => [...table.values()])))
      .not.toContain('private-ai-secret');
    expect(cloud.reports).toHaveLength(1);
  });

  it('preserves local rows and marks sync failed when cloud writes fail', async () => {
    const cloud = fakeTransport();
    await enabled(db);
    await db.runAsync("INSERT INTO ingredients (uuid, name) VALUES ('rice', 'Rice')");
    cloud.transport.upsertRow = async () => { throw new Error('offline'); };
    await expect(syncNow({ db, transport: cloud.transport, userId: USER }))
      .rejects.toThrow('offline');
    expect(await db.getFirstAsync("SELECT name FROM ingredients WHERE uuid = 'rice'"))
      .toMatchObject({ name: 'Rice' });
    expect(await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_meta WHERE key = 'sync_identity_binding'"
    )).toMatchObject({ value: USER });
  });

  it('rolls back an incomplete cloud pull instead of keeping half a recipe', async () => {
    const cloud = fakeTransport();
    await enabled(db);
    cloud.rows.get('ingredients')?.set('oats', {
      uuid: 'oats', user_id: USER, updated_at: '2025-01-01T00:00:00.000Z',
      payload: {
        name: 'Oats', category: 'other', default_unit: 'g', default_quantity: null,
        is_pantry_staple: false, shelf_life_days: null, notes: null, active: true,
        sort_order: 0, deleted: false,
      },
    });
    cloud.rows.get('recipe_ingredients')?.set('orphan', {
      uuid: 'orphan', user_id: USER, updated_at: '2025-01-01T00:00:00.000Z',
      payload: {
        recipe_uuid: 'missing-recipe', ingredient_uuid: 'oats',
        quantity: 100, unit: 'g', note: null, optional: false, sort_order: 0,
      },
    });
    await expect(syncNow({ db, transport: cloud.transport, userId: USER }))
      .rejects.toThrow('Missing recipes');
    expect(await db.getFirstAsync("SELECT id FROM ingredients WHERE uuid = 'oats'")).toBeNull();
    expect(await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_meta WHERE key = 'pull_in_progress'"
    )).toBeNull();
  });

  it('restores a checked generated item from another device without transferring its row ID', async () => {
    const cloud = fakeTransport();
    await enabled(db);
    await db.runAsync("INSERT INTO weeks (uuid, week_start_date) VALUES ('week', '2025-01-06')");
    await db.runAsync("INSERT INTO ingredients (uuid, name) VALUES ('oats', 'Oats')");
    const key = JSON.stringify(['week', null, 'oats', 'g']);
    cloud.rows.get('shopping_checks')?.set('tick', {
      uuid: 'tick', user_id: USER, updated_at: '2025-01-01T00:00:00.000Z',
      payload: {
        week_uuid: 'week', home_uuid: null, ingredient_uuid: 'oats',
        unit: 'g', item_key: key, checked: true,
      },
    });
    await syncNow({ db, transport: cloud.transport, userId: USER });
    const week = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM weeks WHERE uuid = 'week'"
    );
    expect((await getShoppingChecks(week!.id, db)).get(key)).toBe(true);
    expect(cloud.rows.get('shopping_checks')?.get('tick')?.payload).not.toHaveProperty('week_id');
  });

  it('persists generated ticks under stable UUID keys across row replacement', async () => {
    await db.runAsync("INSERT INTO ingredients (uuid, name) VALUES ('oats', 'Oats')");
    await db.runAsync("INSERT INTO weeks (uuid, week_start_date) VALUES ('week', '2025-01-06')");
    const ingredient = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM ingredients WHERE uuid = 'oats'"
    );
    const week = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM weeks WHERE uuid = 'week'"
    );
    const result = await db.runAsync(
      `INSERT INTO shopping_items (week_id, ingredient_id, label, quantity, unit, manual)
       VALUES (?, ?, 'Oats', 200, 'g', 0)`, [week!.id, ingredient!.id]
    );
    await setShoppingItemChecked(result.lastInsertRowId, true, db);
    const key = await shoppingCheckKey(week!.id, null, ingredient!.id, 'g', db);
    expect(await db.getFirstAsync<{ checked: number }>(
      'SELECT checked FROM shopping_checks WHERE item_key = ?', [key]
    )).toMatchObject({ checked: 1 });
    expect(await getShoppingItems(week!.id, db)).toHaveLength(1);
    await saveShoppingCheck(week!.id, null, ingredient!.id, 'g', false, db);
    expect(await db.getFirstAsync<{ checked: number }>(
      'SELECT checked FROM shopping_checks WHERE item_key = ?', [key]
    )).toMatchObject({ checked: 0 });
  });

  it('migrates previously checked generated shopping rows without discarding them', async () => {
    const legacy = databaseFixture();
    try {
      await migrateThrough(legacy.db, 8);
      await legacy.db.runAsync("INSERT INTO ingredients (uuid, name) VALUES ('rice', 'Rice')");
      await legacy.db.runAsync(
        "INSERT INTO weeks (uuid, week_start_date) VALUES ('week', '2025-01-06')"
      );
      await legacy.db.runAsync(
        `INSERT INTO shopping_items (week_id, ingredient_id, label, unit, checked, manual)
         VALUES ((SELECT id FROM weeks WHERE uuid = 'week'),
                 (SELECT id FROM ingredients WHERE uuid = 'rice'), 'Rice', 'g', 1, 0)`
      );
      const migration = MIGRATIONS.find((item) => item.id === 9)!;
      await legacy.db.withTransactionAsync(async () => {
        await legacy.db.execAsync(migration.sql);
        await migration.apply?.(legacy.db, 8);
      });
      expect(await legacy.db.getFirstAsync<{ checked: number }>(
        'SELECT checked FROM shopping_checks'
      )).toMatchObject({ checked: 1 });
    } finally {
      legacy.sqlite.close();
    }
  });
});
