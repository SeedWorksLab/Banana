import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

export interface UpdatePreferences {
  enabled: boolean;
  ignoredVersion: string | null;
}

export async function getUpdatePreferences(db?: SQLiteDatabase): Promise<UpdatePreferences> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('check_for_updates', 'ignored_update_version')"
  );
  return {
    enabled: rows.find((row) => row.key === 'check_for_updates')?.value === '1',
    ignoredVersion: rows.find((row) => row.key === 'ignored_update_version')?.value || null,
  };
}

export async function saveUpdatePreferences(
  patch: Partial<UpdatePreferences>, db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  const entries: [string, string | undefined][] = [
    ['check_for_updates', patch.enabled === undefined ? undefined : patch.enabled ? '1' : '0'],
    ['ignored_update_version', patch.ignoredVersion === undefined ? undefined : patch.ignoredVersion ?? ''],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined) await database.runAsync(
      `INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, new Date().toISOString()]
    );
  }
}
