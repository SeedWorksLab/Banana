import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';
import { DICTATION_ENGINES, DICTATION_LANGUAGES, WHISPER_MODEL_IDS, type DictationSettings } from '../models/dictation';

export const DEFAULT_DICTATION_SETTINGS: DictationSettings = {
  engine: 'android', model: 'base', language: 'interface',
};

const KEYS: Record<keyof DictationSettings, string> = {
  engine: 'dictation_engine', model: 'dictation_model', language: 'dictation_language',
};

export async function getDictationSettings(db?: SQLiteDatabase): Promise<DictationSettings> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('dictation_engine', 'dictation_model', 'dictation_language')",
  );
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const engine = values.get(KEYS.engine);
  const model = values.get(KEYS.model);
  const language = values.get(KEYS.language);
  return {
    engine: DICTATION_ENGINES.find((value) => value === engine) ?? DEFAULT_DICTATION_SETTINGS.engine,
    model: WHISPER_MODEL_IDS.find((value) => value === model) ?? DEFAULT_DICTATION_SETTINGS.model,
    language: DICTATION_LANGUAGES.find((value) => value === language) ?? DEFAULT_DICTATION_SETTINGS.language,
  };
}

export async function updateDictationSettings(patch: Partial<DictationSettings>, db?: SQLiteDatabase): Promise<DictationSettings> {
  const database = db ?? (await getDatabase());
  for (const field of Object.keys(patch) as (keyof DictationSettings)[]) {
    const value = patch[field];
    const allowed = field === 'engine' ? DICTATION_ENGINES : field === 'model' ? WHISPER_MODEL_IDS : DICTATION_LANGUAGES;
    if (!value || !(allowed as readonly string[]).includes(value)) throw new Error('Invalid dictation setting.');
    await database.runAsync(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [KEYS[field], value],
    );
  }
  return getDictationSettings(database);
}
