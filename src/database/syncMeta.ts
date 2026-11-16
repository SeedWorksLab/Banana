import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

export async function getSyncMeta(key: string, db?: SQLiteDatabase): Promise<string | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?', [key]
  );
  return row?.value ?? null;
}

export async function setSyncMeta(
  key: string, value: string, db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`, [key, value]
  );
}

export async function removeSyncMeta(key: string, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM sync_meta WHERE key = ?', [key]);
}

const AUTH_PREFIX = 'auth_session_';

export const authStorage = {
  getItem: (key: string) => getSyncMeta(`${AUTH_PREFIX}${key}`),
  setItem: (key: string, value: string) => setSyncMeta(`${AUTH_PREFIX}${key}`, value),
  removeItem: (key: string) => removeSyncMeta(`${AUTH_PREFIX}${key}`),
};
