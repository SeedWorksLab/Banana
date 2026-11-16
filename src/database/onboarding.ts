import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

export async function getWelcomeSeen(db?: SQLiteDatabase): Promise<boolean> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'welcome_seen'"
  );
  return row?.value === '1';
}

export async function setWelcomeSeen(db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('welcome_seen', '1', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
}
