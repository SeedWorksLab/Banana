import type { SQLiteDatabase } from 'expo-sqlite';
import { DIETS } from '../models';
import type { Diet, Preferences } from '../models';
import { getDatabase } from './database';

export const DEFAULT_PREFERENCES: Preferences = {
  diet: 'omnivore',
  allergies: [],
  dislikes: [],
  defaultServings: 2,
  maxMinutesWeeknight: 45,
  maxMinutesWeekend: 90,
  weeklyBudgetCents: 6000,
  householdName: null,
};

interface PreferencesRow {
  diet: string;
  allergies: string;
  dislikes: string;
  default_servings: number;
  max_minutes_weeknight: number;
  max_minutes_weekend: number;
  weekly_budget_cents: number;
  household_name: string | null;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function parseDiet(value: string): Diet {
  return (DIETS as readonly string[]).includes(value) ? (value as Diet) : 'omnivore';
}

function rowToPreferences(row: PreferencesRow): Preferences {
  return {
    diet: parseDiet(row.diet),
    allergies: parseStringArray(row.allergies),
    dislikes: parseStringArray(row.dislikes),
    defaultServings: row.default_servings,
    maxMinutesWeeknight: row.max_minutes_weeknight,
    maxMinutesWeekend: row.max_minutes_weekend,
    weeklyBudgetCents: row.weekly_budget_cents,
    householdName: row.household_name,
  };
}

export async function getPreferences(db?: SQLiteDatabase): Promise<Preferences> {
  const database = db ?? (await getDatabase());
  await database.runAsync('INSERT OR IGNORE INTO preferences (id) VALUES (1)');
  const row = await database.getFirstAsync<PreferencesRow>(
    `SELECT diet, allergies, dislikes, default_servings, max_minutes_weeknight,
            max_minutes_weekend, weekly_budget_cents, household_name
       FROM preferences
      WHERE id = 1`
  );
  return row ? rowToPreferences(row) : { ...DEFAULT_PREFERENCES };
}

export async function updatePreferences(
  patch: Partial<Preferences>,
  db?: SQLiteDatabase
): Promise<Preferences> {
  const database = db ?? (await getDatabase());
  const next: Preferences = { ...(await getPreferences(database)), ...patch };
  await database.runAsync(
    `UPDATE preferences
        SET diet = ?, allergies = ?, dislikes = ?, default_servings = ?,
            max_minutes_weeknight = ?, max_minutes_weekend = ?, weekly_budget_cents = ?,
            household_name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = 1`,
    [
      next.diet,
      JSON.stringify(next.allergies),
      JSON.stringify(next.dislikes),
      next.defaultServings,
      next.maxMinutesWeeknight,
      next.maxMinutesWeekend,
      next.weeklyBudgetCents,
      next.householdName,
    ]
  );
  return next;
}
