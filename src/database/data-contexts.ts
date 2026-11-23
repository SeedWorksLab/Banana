import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';
import { getSyncMeta, setSyncMeta } from './syncMeta';
import { SEED_STORES_SQL } from './schema';
import { newUuid } from '../utils/uuid';
import { getSyncState } from './syncState';

const TABLES = [
  'homes', 'stores', 'preferences', 'ingredients', 'ingredient_aliases', 'recipes',
  'recipe_ingredients', 'recipe_steps', 'recipe_tags', 'pantry', 'weeks',
  'week_day_budgets', 'slots', 'slot_events', 'shopping_items', 'shopping_checks',
  'deals', 'deal_matches', 'scrape_runs', 'ai_runs', 'sync_outbox', 'sync_tombstones', 'sync_state',
] as const;
const PERSONAL_SETTINGS = "'username', 'welcome_seen', 'tutorial_seen', 'check_for_updates', 'ignored_update_version'";

interface ContextSnapshot {
  tables: Record<string, Record<string, SQLiteBindValue>[]>;
}

export async function switchDataContext(
  identityId: string, accountId: string, db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  const enabled = (await getSyncState(database)).enabled;
  const current = await getSyncMeta('active_data_context', database)
    ?? await getSyncMeta('sync_identity_binding', database) ?? accountId;
  if (current === identityId) {
    await setSyncMeta('active_data_context', identityId, database);
    return;
  }
  await database.withTransactionAsync(async () => {
    const snapshot: ContextSnapshot = { tables: {} };
    for (const table of TABLES) {
      snapshot.tables[table] = await database.getAllAsync(`SELECT * FROM ${table}`);
    }
    const settings = await database.getAllAsync<Record<string, SQLiteBindValue>>(
      `SELECT * FROM settings WHERE key NOT IN (${PERSONAL_SETTINGS})`
    );
    snapshot.tables.settings = settings;
    await database.runAsync(
      `INSERT INTO data_contexts(identity_id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(identity_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      [current, JSON.stringify(snapshot), new Date().toISOString()]
    );
    const saved = await database.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM data_contexts WHERE identity_id = ?', [identityId]
    );
    const next = saved ? JSON.parse(saved.payload) as ContextSnapshot : null;
    await setSyncMeta('pull_in_progress', '1', database);
    for (const table of [...TABLES].reverse()) await database.runAsync(`DELETE FROM ${table}`);
    await database.runAsync(`DELETE FROM settings WHERE key NOT IN (${PERSONAL_SETTINGS})`);
    if (next) {
      for (const table of [...TABLES, 'settings']) {
        const available = new Set((await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`))
          .map((column) => column.name));
        for (const row of next.tables[table] ?? []) {
          const columns = Object.keys(row).filter((key) => available.has(key));
          await database.runAsync(
            `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
            columns.map((key) => row[key])
          );
        }
      }
    } else {
      await database.execAsync(SEED_STORES_SQL);
      await database.runAsync('INSERT INTO preferences (id, uuid) VALUES (1, ?)', [newUuid()]);
    }
    await setSyncMeta('active_data_context', identityId, database);
    await setSyncMeta('sync_identity_binding', identityId, database);
    await setSyncMeta('pull_in_progress', '0', database);
    await database.runAsync(
      `INSERT INTO sync_state(id, enabled) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled`, [enabled ? 1 : 0]
    );
  });
}
