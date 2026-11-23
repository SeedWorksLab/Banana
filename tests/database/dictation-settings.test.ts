import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_DICTATION_SETTINGS, getDictationSettings, updateDictationSettings } from '../../src/database/dictation-settings';

it('defaults existing installations to Android and persists independent device settings without schema changes', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)');
  const db = {
    runAsync: async (sql: string, params: string[]) => sqlite.prepare(sql).run(...params),
    getAllAsync: async (sql: string) => sqlite.prepare(sql).all(),
  } as unknown as SQLiteDatabase;
  try {
    expect(await getDictationSettings(db)).toEqual(DEFAULT_DICTATION_SETTINGS);
    await updateDictationSettings({ engine: 'whisper', model: 'small', language: 'de' }, db);
    expect(await getDictationSettings(db)).toEqual({ engine: 'whisper', model: 'small', language: 'de' });
    await updateDictationSettings({ language: 'auto' }, db);
    expect((await getDictationSettings(db)).language).toBe('auto');
    sqlite.exec("UPDATE settings SET value = 'corrupt'");
    expect(await getDictationSettings(db)).toEqual(DEFAULT_DICTATION_SETTINGS);
  } finally { sqlite.close(); }
});
