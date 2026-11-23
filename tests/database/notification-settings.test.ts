import type { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_SETTINGS, getSettings } from '../../src/database/settings';
import { SYNC_SETTINGS_KEYS } from '../../src/sync/tables';

it.each(['0', 'false', '1', 'true'])('ignores the obsolete notification opt-out value %s from old databases or backups', async (value) => {
  const db = {
    getAllAsync: async () => [{ key: 'notifications_enabled', value }],
  } as unknown as SQLiteDatabase;
  const settings = await getSettings(db);
  expect(settings).toEqual(DEFAULT_SETTINGS);
  expect('notificationsEnabled' in settings).toBe(false);
  expect(SYNC_SETTINGS_KEYS).not.toContain('notifications_enabled');
});
