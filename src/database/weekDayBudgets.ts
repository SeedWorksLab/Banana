import type { SQLiteDatabase } from 'expo-sqlite';
import { DAY_MODES } from '../models';
import type { DayMode, WeekDay, WeekDayBudget } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

interface WeekDayBudgetRow {
  id: number;
  uuid: string | null;
  week_id: number;
  day: WeekDay;
  mode: DayMode;
  cook_minutes: number;
  servings: number | null;
  home_id: number | null;
  created_at: string;
  updated_at: string | null;
}

function parseMode(value: string): DayMode {
  return (DAY_MODES as readonly string[]).includes(value) ? (value as DayMode) : 'cook';
}

function rowToWeekDayBudget(row: WeekDayBudgetRow): WeekDayBudget {
  return {
    id: row.id,
    uuid: row.uuid,
    weekId: row.week_id,
    day: row.day,
    mode: parseMode(row.mode),
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    homeId: row.home_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, uuid, week_id, day, mode, cook_minutes, servings, home_id,
                       created_at, updated_at
                  FROM week_day_budgets`;

export async function getWeekDayBudgets(
  weekId: number,
  db?: SQLiteDatabase
): Promise<WeekDayBudget[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<WeekDayBudgetRow>(
    `${SELECT} WHERE week_id = ? ORDER BY day`,
    [weekId]
  );
  return rows.map(rowToWeekDayBudget);
}

export async function upsertWeekDayBudget(
  input: {
    weekId: number;
    day: WeekDay;
    mode: DayMode;
    cookMinutes: number;
    servings?: number | null;
    homeId?: number | null;
  },
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `INSERT INTO week_day_budgets (uuid, week_id, day, mode, cook_minutes, servings, home_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (week_id, day) DO UPDATE
       SET mode = excluded.mode, cook_minutes = excluded.cook_minutes,
           servings = excluded.servings,
           home_id = COALESCE(excluded.home_id, week_day_budgets.home_id),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    [
      newUuid(),
      input.weekId,
      input.day,
      input.mode,
      input.cookMinutes,
      input.servings ?? null,
      input.homeId ?? null,
    ]
  );
}

export async function setWeekDayHome(
  weekId: number,
  day: WeekDay,
  homeId: number | null,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE week_day_budgets
        SET home_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE week_id = ? AND day = ?`,
    [homeId, weekId, day]
  );
}

export async function deleteWeekDayBudgets(
  weekId: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM week_day_budgets WHERE week_id = ?', [weekId]);
}
