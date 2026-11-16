import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

export const SYNC_STATUSES = ['idle', 'syncing', 'success', 'error'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export interface SyncState {
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: SyncStatus | null;
  lastSyncError: string | null;
}

export const DEFAULT_SYNC_STATE: SyncState = {
  enabled: false,
  lastSyncAt: null,
  lastSyncStatus: null,
  lastSyncError: null,
};

interface SyncStateRow {
  enabled: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

export async function getSyncState(db?: SQLiteDatabase): Promise<SyncState> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SyncStateRow>(
    'SELECT enabled, last_sync_at, last_sync_status, last_sync_error FROM sync_state WHERE id = 1'
  );
  return row ? {
    enabled: row.enabled === 1,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: SYNC_STATUSES.find((status) => status === row.last_sync_status) ?? null,
    lastSyncError: row.last_sync_error,
  } : { ...DEFAULT_SYNC_STATE };
}

export async function updateSyncState(
  patch: Partial<SyncState>,
  db?: SQLiteDatabase
): Promise<SyncState> {
  const database = db ?? (await getDatabase());
  const next = { ...(await getSyncState(database)), ...patch };
  await database.runAsync(
    `INSERT INTO sync_state (id, enabled, last_sync_at, last_sync_status, last_sync_error)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled,
       last_sync_at = excluded.last_sync_at, last_sync_status = excluded.last_sync_status,
       last_sync_error = excluded.last_sync_error`,
    [next.enabled ? 1 : 0, next.lastSyncAt, next.lastSyncStatus, next.lastSyncError]
  );
  return next;
}
