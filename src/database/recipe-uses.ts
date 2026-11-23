import type { SQLiteDatabase } from 'expo-sqlite';
import type { WeekDay } from '../models';
import type { RecipeUse } from '../models/recipe-use';
import { addDays } from '../utils/date';
import { getDatabase } from './database';

interface RecipeUseRow {
  recipe_id: number;
  week_start_date: string;
  day: WeekDay;
}

export async function getRecipeUsesBeforeWeek(weekStartDate: string, db?: SQLiteDatabase): Promise<RecipeUse[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<RecipeUseRow>(
    `SELECT s.recipe_id, w.week_start_date, s.day FROM slots s
      JOIN weeks w ON w.id = s.week_id
      WHERE s.deleted = 0 AND w.deleted = 0 AND s.kind = 'recipe' AND s.recipe_id IS NOT NULL
        AND w.week_start_date < ? AND w.week_start_date >= ?
      ORDER BY w.week_start_date, s.day, s.id`,
    [weekStartDate, addDays(weekStartDate, -28)],
  );
  return rows.map((row) => ({ recipeId: row.recipe_id, weekStartDate: row.week_start_date, day: row.day }));
}
