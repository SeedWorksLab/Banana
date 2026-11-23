import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../database/database';
import { getSyncMeta, setSyncMeta } from '../database/syncMeta';
import { getSyncState, updateSyncState } from '../database/syncState';
import { SYNC_SETTINGS_KEYS, SYNC_TABLES, type SyncTable } from './tables';
import { getClient, getSignedInUser } from './supabase';
import { resolveDataIdentity } from './households';
import { switchDataContext } from '../database/data-contexts';
import { createSupabaseTransport, type RemoteRow, type RemoteTombstone, type SyncTransport } from './transport';

interface LocalRow extends Record<string, unknown> {
  id: number;
  uuid: string;
  updated_at: string | null;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  deleted: number;
}

export interface SyncOptions {
  db?: SQLiteDatabase;
  transport?: SyncTransport;
  userId?: string;
}

const TABLE_BY_NAME = new Map(SYNC_TABLES.map((table) => [table.name, table]));
const PROFILE_KEY = 'username';
const IDENTITY_KEY = 'sync_identity_binding';
const GUARD_KEY = 'pull_in_progress';

let pendingSync: Promise<SyncResult | null> | null = null;

function millis(value: string | null | undefined): number {
  return value ? Date.parse(value) || 0 : 0;
}

function isoTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid cloud timestamp');
  return new Date(parsed).toISOString();
}

function binding(value: unknown): SQLiteBindValue {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  throw new Error('Invalid sync payload');
}

function referenceName(column: string): string {
  return `${column.slice(0, -3)}_uuid`;
}

async function localByUuid(db: SQLiteDatabase, table: SyncTable, uuid: string): Promise<LocalRow | null> {
  return db.getFirstAsync<LocalRow>(`SELECT * FROM ${table.name} WHERE uuid = ?`, [uuid]);
}

async function localRows(db: SQLiteDatabase, table: SyncTable): Promise<LocalRow[]> {
  return db.getAllAsync<LocalRow>(
    `SELECT * FROM ${table.name}${table.onlyManual ? ' WHERE manual = 1' : ''}`
  );
}

async function toRemotePayload(
  db: SQLiteDatabase, table: SyncTable, row: LocalRow
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {};
  for (const column of table.columns) {
    const parent = table.references?.[column];
    if (parent) {
      const id = row[column];
      const match = id == null ? null : await db.getFirstAsync<{ uuid: string }>(
        `SELECT uuid FROM ${parent} WHERE id = ?`, [binding(id)]
      );
      if (id != null && !match?.uuid) {
        throw new Error(`Missing ${parent} for ${table.name}.${column}`);
      }
      payload[referenceName(column)] = match?.uuid ?? null;
    } else {
      const value = row[column] ?? null;
      payload[column] = table.booleans?.includes(column) ? value === 1 : value;
    }
  }
  return payload;
}

async function toLocalValues(
  db: SQLiteDatabase, table: SyncTable, payload: Record<string, unknown>
): Promise<Record<string, SQLiteBindValue>> {
  const values: Record<string, SQLiteBindValue> = {};
  for (const column of table.columns) {
    const parent = table.references?.[column];
    if (parent) {
      const parentUuid = payload[referenceName(column)];
      if (parentUuid == null) {
        values[column] = null;
      } else {
        if (typeof parentUuid !== 'string') throw new Error('Invalid parent UUID');
        const local = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM ${parent} WHERE uuid = ?`, [parentUuid]
        );
        if (!local) throw new Error(`Missing ${parent} for ${table.name}.${column}`);
        values[column] = local.id;
      }
    } else if (Object.prototype.hasOwnProperty.call(payload, column)) {
      values[column] = binding(payload[column]);
    }
  }
  if (table.name === 'shopping_checks') {
    const week = payload.week_uuid;
    const home = payload.home_uuid;
    const ingredient = payload.ingredient_uuid;
    const unit = payload.unit;
    if (typeof week !== 'string' || typeof ingredient !== 'string' ||
        typeof unit !== 'string' || (home !== null && typeof home !== 'string')) {
      throw new Error('Invalid shopping check identity');
    }
    values.item_key = JSON.stringify([week, home, ingredient, unit]);
  }
  return values;
}

async function naturalMatch(
  db: SQLiteDatabase, table: SyncTable, values: Record<string, SQLiteBindValue>
): Promise<LocalRow | null> {
  if (table.name === 'preferences') {
    return db.getFirstAsync<LocalRow>('SELECT * FROM preferences WHERE id = 1');
  }
  const keys = table.naturalKey;
  if (!keys?.length || keys.some((key) => values[key] == null)) return null;
  const where = keys.map((key) => `${key} = ?`).join(' AND ');
  return db.getFirstAsync<LocalRow>(
    `SELECT * FROM ${table.name} WHERE ${where} LIMIT 1`,
    keys.map((key) => values[key])
  );
}

async function applyRemote(
  db: SQLiteDatabase, table: SyncTable, remote: RemoteRow, firstSync: boolean
): Promise<void> {
  if (!remote.uuid || !remote.payload || typeof remote.payload !== 'object') {
    throw new Error(`Invalid ${table.name} row from cloud`);
  }
  if (table.onlyManual && remote.payload.manual !== true) {
    throw new Error('Cloud shopping item is not a manual item');
  }
  const values = await toLocalValues(db, table, remote.payload);
  const existing = (await localByUuid(db, table, remote.uuid))
    ?? (await naturalMatch(db, table, values));
  const dirty = existing ? await db.getFirstAsync<{ row_key: string }>(
    'SELECT row_key FROM sync_outbox WHERE table_name = ? AND row_key = ?',
    [table.name, existing.uuid]
  ) : null;
  const seeded = firstSync && existing && (
    (table.name === 'stores' && existing.updated_at === existing.created_at) ||
    (table.name === 'homes' && existing.uuid === 'home-default' && existing.name === 'Home'
      && existing.updated_at === existing.created_at) ||
    (table.name === 'preferences' && existing.diet === 'omnivore' &&
      (existing.allergies === '[]' || existing.allergies == null) &&
      (existing.dislikes === '[]' || existing.dislikes == null) &&
      existing.household_name == null && existing.default_servings === 2 &&
      existing.max_minutes_weeknight === 30 && existing.max_minutes_weekend === 60 &&
      existing.weekly_budget_cents === 8000)
  );
  if (existing && !seeded && (
    millis(existing.updated_at) > millis(remote.updated_at) ||
    (dirty && millis(existing.updated_at) === millis(remote.updated_at))
  )) {
    if (existing.uuid !== remote.uuid) {
      await db.runAsync(`UPDATE ${table.name} SET uuid = ? WHERE id = ?`, [remote.uuid, existing.id]);
      await db.runAsync(
        `DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ?`,
        [table.name, existing.uuid]
      );
      await db.runAsync(
        `INSERT INTO sync_outbox (table_name, row_key) VALUES (?, ?)
         ON CONFLICT (table_name, row_key) DO NOTHING`,
        [table.name, remote.uuid]
      );
    }
    return;
  }
  values.uuid = remote.uuid;
  values.updated_at = isoTimestamp(remote.updated_at);
  const columns = Object.keys(values);
  if (existing) {
    await db.runAsync(
      `UPDATE ${table.name} SET ${columns.map((column) => `${column} = ?`).join(', ')}
       WHERE id = ?`,
      [...columns.map((column) => values[column]), existing.id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO ${table.name} (${columns.join(', ')})
       VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((column) => values[column])
    );
  }
  await db.runAsync(
    'DELETE FROM sync_outbox WHERE table_name = ? AND row_key IN (?, ?)',
    [table.name, remote.uuid, existing?.uuid ?? remote.uuid]
  );
}

async function applyTombstones(
  db: SQLiteDatabase, tombstones: readonly RemoteTombstone[],
  pendingDeletes: ReadonlySet<string>
): Promise<Set<string>> {
  const keys = new Set<string>();
  const ordered = [...tombstones].sort((a, b) =>
    (SYNC_TABLES.findIndex((table) => table.name === b.table_name)) -
    (SYNC_TABLES.findIndex((table) => table.name === a.table_name))
  );
  for (const tombstone of ordered) {
    const table = TABLE_BY_NAME.get(tombstone.table_name);
    if (!table) continue;
    const key = `${table.name}:${tombstone.row_key}`;
    if (pendingDeletes.has(key)) {
      keys.add(key);
      continue;
    }
    keys.add(key);
    await db.runAsync(`DELETE FROM ${table.name} WHERE uuid = ?`, [tombstone.row_key]);
    await db.runAsync(
      'DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ?',
      [table.name, tombstone.row_key]
    );
  }
  return keys;
}

async function normalizeShoppingCheckKeys(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{
    id: number; item_key: string; week_uuid: string; home_uuid: string | null;
    ingredient_uuid: string; unit: string; updated_at: string | null;
  }>(
    `SELECT c.id, c.item_key, w.uuid AS week_uuid, h.uuid AS home_uuid,
            i.uuid AS ingredient_uuid, c.unit, c.updated_at
       FROM shopping_checks c
       JOIN weeks w ON w.id = c.week_id
       LEFT JOIN homes h ON h.id = c.home_id
       JOIN ingredients i ON i.id = c.ingredient_id`
  );
  for (const row of rows) {
    const key = JSON.stringify([row.week_uuid, row.home_uuid, row.ingredient_uuid, row.unit]);
    if (key === row.item_key) continue;
    const duplicate = await db.getFirstAsync<{ id: number; updated_at: string | null }>(
      'SELECT id, updated_at FROM shopping_checks WHERE item_key = ?', [key]
    );
    if (duplicate) {
      const winner = millis(row.updated_at) > millis(duplicate.updated_at) ? row.id : duplicate.id;
      await db.runAsync('DELETE FROM shopping_checks WHERE id = ?', [
        winner === row.id ? duplicate.id : row.id,
      ]);
      if (winner !== row.id) continue;
    }
    await db.runAsync('UPDATE shopping_checks SET item_key = ? WHERE id = ?', [key, row.id]);
  }
}

async function syncSettings(db: SQLiteDatabase, transport: SyncTransport, userId: string): Promise<void> {
  const remotes = new Map((await transport.listSettings(userId))
    .filter((setting) => (SYNC_SETTINGS_KEYS as readonly string[]).includes(setting.key))
    .map((setting) => [setting.key, setting]));
  for (const key of SYNC_SETTINGS_KEYS) {
    const local = await db.getFirstAsync<{ value: string; updated_at: string | null }>(
      'SELECT value, updated_at FROM settings WHERE key = ?', [key]
    );
    const remote = remotes.get(key);
    if (remote && (!local || millis(remote.updated_at) > millis(local.updated_at))) {
      await db.runAsync(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, remote.value, isoTimestamp(remote.updated_at)]
      );
    } else if (local && (!remote || millis(local.updated_at) > millis(remote.updated_at))) {
      await transport.upsertSetting(userId, {
        key, value: local.value, updated_at: local.updated_at ?? new Date().toISOString(),
      });
    }
  }
}

async function syncUsername(db: SQLiteDatabase, transport: SyncTransport, userId: string): Promise<void> {
  const profile = await transport.getProfile(userId);
  if (!profile) throw new Error('SeedWorks profile does not exist');
  const local = await db.getFirstAsync<{ value: string; updated_at: string | null }>(
    'SELECT value, updated_at FROM settings WHERE key = ?', [PROFILE_KEY]
  );
  if (local && millis(local.updated_at) > millis(profile.updated_at)) {
    await transport.setProfile(userId, local.value.trim().slice(0, 80) || null);
  } else if (profile.display_name !== null || local) {
    await db.runAsync(
      `INSERT INTO settings (key, value, updated_at) VALUES ('username', ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [profile.display_name ?? '', isoTimestamp(profile.updated_at)]
    );
  }
}

function utf8Bytes(text: string): number {
  let length = 0;
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    length += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return length;
}

async function usage(db: SQLiteDatabase): Promise<{ records: number; bytes: number }> {
  let records = 0;
  let bytes = 0;
  for (const table of SYNC_TABLES) {
    for (const row of await localRows(db, table)) {
      if (row.deleted === 1) continue;
      records += 1;
      bytes += utf8Bytes(JSON.stringify(await toRemotePayload(db, table, row)));
    }
  }
  return { records, bytes };
}

async function runSync(options: SyncOptions): Promise<SyncResult | null> {
  const db = options.db ?? (await getDatabase());
  let state = await getSyncState(db);
  if (!state.enabled) return null;
  const accountId = options.userId ?? (await getSignedInUser())?.id;
  if (!accountId) throw new Error('Sign in to SeedWorks to sync.');
  const userId = options.userId ?? await resolveDataIdentity();
  if (!options.userId) {
    await switchDataContext(userId, accountId, db);
    state = await getSyncState(db);
  }
  const identity = await getSyncMeta(IDENTITY_KEY, db);
  if (identity && identity !== userId) {
    throw new Error('This local data is already linked to a different SeedWorks account.');
  }
  if (!identity) await setSyncMeta(IDENTITY_KEY, userId, db);
  const transport = options.transport ?? createSupabaseTransport(getClient());
  const firstSync = !state.lastSyncAt;
  const startedAt = new Date().toISOString();
  await updateSyncState({ lastSyncStatus: 'syncing', lastSyncError: null }, db);
  try {
    const tombstones = await transport.listTombstones(userId);
    const pendingDeletes = await db.getAllAsync<RemoteTombstone>(
      'SELECT table_name, row_key, deleted_at FROM sync_tombstones'
    );
    const pendingKeys = new Set(pendingDeletes.map(
      (row) => `${row.table_name}:${row.row_key}`
    ));
    const applicableTombstones: RemoteTombstone[] = [];
    for (const tombstone of tombstones) {
      const table = TABLE_BY_NAME.get(tombstone.table_name);
      if (!table || pendingKeys.has(`${table.name}:${tombstone.row_key}`)) {
        applicableTombstones.push(tombstone);
        continue;
      }
      const local = await localByUuid(db, table, tombstone.row_key);
      if (local && millis(local.updated_at) > millis(tombstone.deleted_at)) {
        await transport.deleteTombstone(userId, table.name, tombstone.row_key);
      } else {
        applicableTombstones.push(tombstone);
      }
    }
    const remoteByTable = new Map<string, RemoteRow[]>();
    for (const table of SYNC_TABLES) {
      remoteByTable.set(table.name, await transport.listRows(table.name, userId));
    }
    let excluded = new Set<string>();
    let pulled = 0;
    await db.withTransactionAsync(async () => {
      await setSyncMeta(GUARD_KEY, '1', db);
      try {
        excluded = await applyTombstones(db, applicableTombstones, pendingKeys);
        for (const key of pendingKeys) excluded.add(key);
        for (const table of SYNC_TABLES) {
          if (table.name === 'shopping_checks') await normalizeShoppingCheckKeys(db);
          for (const remote of remoteByTable.get(table.name) ?? []) {
            if (excluded.has(`${table.name}:${remote.uuid}`)) continue;
            await applyRemote(db, table, remote, firstSync);
            pulled += 1;
          }
        }
      } finally {
        await setSyncMeta(GUARD_KEY, '0', db);
      }
    });

    let pushed = 0;
    for (const table of SYNC_TABLES) {
      const remoteRows = new Map((remoteByTable.get(table.name) ?? [])
        .map((row) => [row.uuid, row]));
      for (const row of await localRows(db, table)) {
        if (excluded.has(`${table.name}:${row.uuid}`)) continue;
        const remote = remoteRows.get(row.uuid);
        if (remote && millis(row.updated_at) <= millis(remote.updated_at)) continue;
        await transport.upsertRow(table.name, {
          uuid: row.uuid, user_id: userId,
          payload: await toRemotePayload(db, table, row),
          updated_at: row.updated_at ?? startedAt,
        });
        pushed += 1;
        await db.runAsync(
          'DELETE FROM sync_outbox WHERE table_name = ? AND row_key = ?',
          [table.name, row.uuid]
        );
      }
    }
    let deleted = 0;
    for (const tombstone of [...pendingDeletes].sort((a, b) =>
      SYNC_TABLES.findIndex((table) => table.name === b.table_name) -
      SYNC_TABLES.findIndex((table) => table.name === a.table_name)
    )) {
      if (!TABLE_BY_NAME.has(tombstone.table_name)) continue;
      await transport.upsertTombstone(userId, tombstone);
      await transport.deleteRow(tombstone.table_name, tombstone.row_key, userId);
      await db.runAsync(
        'DELETE FROM sync_tombstones WHERE table_name = ? AND row_key = ?',
        [tombstone.table_name, tombstone.row_key]
      );
      deleted += 1;
    }
    await syncSettings(db, transport, userId);
    await syncUsername(db, transport, accountId);
    const { records, bytes } = await usage(db);
    await transport.reportUsage(records, bytes);
    await updateSyncState({
      lastSyncAt: startedAt, lastSyncStatus: 'success', lastSyncError: null,
    }, db);
    return { pulled, pushed, deleted };
  } catch (error) {
    await updateSyncState({
      lastSyncStatus: 'error',
      lastSyncError: error instanceof Error ? error.message : 'Could not sync SeedWorks data',
    }, db);
    throw error;
  }
}

export async function syncNow(options: SyncOptions = {}): Promise<SyncResult | null> {
  if (!pendingSync) {
    pendingSync = runSync(options).finally(() => { pendingSync = null; });
  }
  return pendingSync;
}
