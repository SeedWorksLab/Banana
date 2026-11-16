import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { getWeekDayBudgets, setWeekDayMealSettings } from '../../src/database/weekDayBudgets';

it('migrates existing dinner plans without deleting them and persists independent meal settings', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    runAsync: async (sql: string, params: (string | number | null)[] = []) => sqlite.prepare(sql).run(...params),
    getAllAsync: async (sql: string, params: (string | number | null)[] = []) => sqlite.prepare(sql).all(...params),
  } as unknown as SQLiteDatabase;
  try {
    for (const migration of MIGRATIONS.filter((entry) => entry.id <= 9)) {
      if (migration.sql) await db.execAsync(migration.sql);
    }
    sqlite.exec(`
      INSERT INTO weeks (id, week_start_date, status) VALUES (1, '2026-11-16', 'planning');
      INSERT INTO week_day_budgets (week_id, day, mode, cook_minutes, servings)
        VALUES (1, 'mon', 'cook', 45, 2);
      INSERT INTO slots (week_id, day, meal_type, kind, free_text, servings, pinned)
        VALUES (1, 'mon', 'dinner', 'free_text', 'Family dinner', 2, 1);
      INSERT INTO settings (key, value) VALUES ('dinner_only', '1');
    `);
    const migration = MIGRATIONS.find((entry) => entry.id === 10);
    expect(migration).toBeDefined();
    await db.execAsync(migration!.sql);
    expect(sqlite.prepare('SELECT free_text, pinned FROM slots').get()).toMatchObject({ free_text: 'Family dinner', pinned: 1 });
    expect((await getWeekDayBudgets(1, db))[0].mealSettings).toEqual([]);
    await setWeekDayMealSettings(1, 'mon', [
      { mealType: 'breakfast', mode: 'cook', cookMinutes: 10, enabled: true },
      { mealType: 'lunch', mode: 'eating_out', cookMinutes: 0, enabled: true },
      { mealType: 'dinner', mode: 'cook', cookMinutes: 45, enabled: true },
    ], db);
    expect((await getWeekDayBudgets(1, db))[0].mealSettings[1]).toEqual({
      mealType: 'lunch', mode: 'eating_out', cookMinutes: 0, enabled: true,
    });
    expect(sqlite.prepare("SELECT value FROM settings WHERE key = 'dinner_only'").get()).toMatchObject({ value: '0' });
  } finally {
    sqlite.close();
  }
});
