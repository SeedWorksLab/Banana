import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { getRecipeUsesBeforeWeek } from '../../src/database/recipe-uses';
import { planWeek, type PlannerRecipe } from '../../src/services/planning-service';
import { getRecipeHistory } from '../../src/database/slots';

it('loads prior planned cooking meals but excludes leftovers, deleted data, future weeks and older history', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    getAllAsync: async (sql: string, params: (string | number | null)[] = []) => sqlite.prepare(sql).all(...params),
  } as unknown as SQLiteDatabase;
  try {
    for (const migration of MIGRATIONS) {
      if (migration.sql) await db.execAsync(migration.sql);
      if (migration.id === 11) await migration.apply?.(db, 10);
    }
    sqlite.exec(`
      INSERT INTO recipes (id, name, category) VALUES
        (1, 'Recipe 1', 'dinner'), (2, 'Recipe 2', 'dinner'), (3, 'Recipe 3', 'dinner'),
        (4, 'Recipe 4', 'dinner'), (5, 'Recipe 5', 'dinner'), (6, 'Recipe 6', 'dinner'), (7, 'Recipe 7', 'dinner');
      INSERT INTO weeks (id, week_start_date, deleted) VALUES
        (1, '2026-11-23', 0), (2, '2026-11-16', 0), (3, '2026-10-26', 0),
        (4, '2026-10-19', 0), (5, '2026-11-30', 0), (6, '2026-11-09', 1);
      INSERT INTO slots (week_id, day, meal_type, kind, recipe_id, servings, deleted) VALUES
        (2, 'mon', 'dinner', 'recipe', 1, 4, 0),
        (2, 'tue', 'dinner', 'leftovers', 1, 2, 0),
        (2, 'fri', 'dinner', 'recipe', 1, 2, 0),
        (2, 'sun', 'dinner', 'recipe', 2, 2, 1),
        (3, 'mon', 'dinner', 'recipe', 3, 2, 0),
        (4, 'mon', 'dinner', 'recipe', 4, 2, 0),
        (5, 'mon', 'dinner', 'recipe', 5, 2, 0),
        (6, 'mon', 'dinner', 'recipe', 6, 2, 0),
        (1, 'mon', 'dinner', 'recipe', 7, 2, 0);
    `);
    const uses = await getRecipeUsesBeforeWeek('2026-11-23', db);
    expect(uses).toHaveLength(3);
    expect(uses).toEqual(expect.arrayContaining([
      { recipeId: 1, weekStartDate: '2026-11-16', day: 'mon' },
      { recipeId: 1, weekStartDate: '2026-11-16', day: 'fri' },
      { recipeId: 3, weekStartDate: '2026-10-26', day: 'mon' },
    ]));
    const recipes: PlannerRecipe[] = [1, 2].map((id) => ({
      id, name: `Recipe ${id}`, category: 'dinner', prepMinutes: 5, cookMinutes: 20,
      ingredientNames: [], tags: [], servings: 2, isFavorite: false, batchFriendly: false,
    }));
    expect(planWeek({
      days: [{ day: 'mon', mode: 'cook', cookMinutes: 30 }], recipes, mealType: 'dinner',
      defaultServings: 2, weekStartDate: '2026-11-23', recentUses: uses,
    }).slots[0].recipeId).toBe(2);
    sqlite.exec("UPDATE slots SET cooked_at = '2026-11-17T18:00:00.000Z' WHERE week_id = 2 AND day IN ('mon', 'tue')");
    expect(await getRecipeHistory(db)).toEqual(expect.arrayContaining([
      { recipeId: 1, rating: null, kind: 'recipe' },
      { recipeId: 1, rating: null, kind: 'leftovers' },
    ]));
  } finally { sqlite.close(); }
});
