import type { SQLiteDatabase } from 'expo-sqlite';
import { CURRENCIES, THEME_MODES, WEEK_DAYS } from '../models';
import type { Currency, Settings, ThemeMode, WeekDay } from '../models';
import { getDatabase } from './database';

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  currency: 'EUR',
  defaultServings: 2,
  defaultWeeknightMinutes: 45,
  defaultWeekendMinutes: 90,
  dinnerOnly: true,
  planStartDay: 'sat',
  notificationsEnabled: true,
  shoppingReminderHour: 9,
  planReminderDay: 'fri',
  tutorialSeen: false,
  lastSeenRelease: null,
};

type SettingsKey =
  | 'theme_mode'
  | 'currency'
  | 'default_servings'
  | 'default_weeknight_minutes'
  | 'default_weekend_minutes'
  | 'dinner_only'
  | 'plan_start_day'
  | 'notifications_enabled'
  | 'shopping_reminder_hour'
  | 'plan_reminder_day'
  | 'tutorial_seen'
  | 'last_seen_release';

const SETTINGS_KEY_MAP: Record<keyof Settings, SettingsKey> = {
  themeMode: 'theme_mode',
  currency: 'currency',
  defaultServings: 'default_servings',
  defaultWeeknightMinutes: 'default_weeknight_minutes',
  defaultWeekendMinutes: 'default_weekend_minutes',
  dinnerOnly: 'dinner_only',
  planStartDay: 'plan_start_day',
  notificationsEnabled: 'notifications_enabled',
  shoppingReminderHour: 'shopping_reminder_hour',
  planReminderDay: 'plan_reminder_day',
  tutorialSeen: 'tutorial_seen',
  lastSeenRelease: 'last_seen_release',
};

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseThemeMode(value: string): ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value)
    ? (value as ThemeMode)
    : DEFAULT_SETTINGS.themeMode;
}

function parseWeekDay(value: string, fallback: WeekDay): WeekDay {
  return (WEEK_DAYS as readonly string[]).includes(value) ? (value as WeekDay) : fallback;
}

function parseCurrency(value: string): Currency {
  return (CURRENCIES as readonly string[]).includes(value)
    ? (value as Currency)
    : DEFAULT_SETTINGS.currency;
}

function rowToSettings(rows: { key: SettingsKey; value: string }[]): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    switch (row.key) {
      case 'theme_mode':
        settings.themeMode = parseThemeMode(row.value);
        break;
      case 'currency':
        settings.currency = parseCurrency(row.value);
        break;
      case 'default_servings':
        settings.defaultServings = clampInt(Number(row.value), 1, 20, DEFAULT_SETTINGS.defaultServings);
        break;
      case 'default_weeknight_minutes':
        settings.defaultWeeknightMinutes = clampInt(
          Number(row.value),
          5,
          240,
          DEFAULT_SETTINGS.defaultWeeknightMinutes
        );
        break;
      case 'default_weekend_minutes':
        settings.defaultWeekendMinutes = clampInt(
          Number(row.value),
          5,
          480,
          DEFAULT_SETTINGS.defaultWeekendMinutes
        );
        break;
      case 'dinner_only':
        settings.dinnerOnly = row.value !== '0' && row.value !== 'false';
        break;
      case 'plan_start_day':
        settings.planStartDay = parseWeekDay(row.value, DEFAULT_SETTINGS.planStartDay);
        break;
      case 'notifications_enabled':
        settings.notificationsEnabled = row.value !== '0' && row.value !== 'false';
        break;
      case 'shopping_reminder_hour':
        settings.shoppingReminderHour = clampInt(
          Number(row.value),
          0,
          23,
          DEFAULT_SETTINGS.shoppingReminderHour
        );
        break;
      case 'plan_reminder_day':
        settings.planReminderDay = parseWeekDay(row.value, DEFAULT_SETTINGS.planReminderDay);
        break;
      case 'tutorial_seen':
        settings.tutorialSeen = row.value === '1' || row.value === 'true';
        break;
      case 'last_seen_release':
        settings.lastSeenRelease = row.value === '' ? null : row.value;
        break;
    }
  }
  return settings;
}

export async function getSettings(db?: SQLiteDatabase): Promise<Settings> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<{ key: SettingsKey; value: string }>(
    'SELECT key, value FROM settings'
  );
  return rowToSettings(rows);
}

export async function updateSettings(
  patch: Partial<Settings>,
  db?: SQLiteDatabase
): Promise<Settings> {
  const database = db ?? (await getDatabase());
  const next: Settings = { ...(await getSettings(database)), ...patch };
  for (const [field, key] of Object.entries(SETTINGS_KEY_MAP) as [keyof Settings, SettingsKey][]) {
    const value = next[field];
    const encoded =
      typeof value === 'boolean' ? (value ? '1' : '0') : value === null ? '' : String(value);
    await database.runAsync(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, encoded]
    );
  }
  return next;
}
