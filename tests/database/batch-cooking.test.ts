import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { createSlot, deleteSlot, getSlotsByWeek, updateSlot } from '../../src/database/slots';

it('preserves existing meals, persists batch links, and removes reservations with their source', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    runAsync: async (sql: string, params: (string | number | null)[] = []) => {
      const result = sqlite.prepare(sql).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getAllAsync: async (sql: string, params: (string | number | null)[] = []) => sqlite.prepare(sql).all(...params),
  } as unknown as SQLiteDatabase;
  try {
    for (const migration of MIGRATIONS) {
      if (migration.sql) await db.execAsync(migration.sql);
      if (migration.id === 11) await migration.apply?.(db, 10);
    }
    sqlite.exec(`
      INSERT INTO weeks (id, week_start_date, status) VALUES (1, '2026-11-16', 'planning');
      INSERT INTO recipes (id, name, category) VALUES (1, 'Rice', 'dinner');
    `);
    const input = {
      weekId: 1, day: 'tue' as const, mealType: 'dinner' as const, kind: 'recipe' as const,
      recipeId: 1, freeText: null, servings: 2, note: null, pinned: true, sortOrder: 0,
    };
    const sourceId = await createSlot(input, db);
    const source = (await getSlotsByWeek(1, db))[0];
    await createSlot({ ...input, day: 'wed', kind: 'leftovers', servings: 1, batchSourceUuid: source.uuid }, db);
    const meals = await getSlotsByWeek(1, db);
    expect(meals).toHaveLength(2);
    expect(meals[1].batchSourceUuid).toBe(source.uuid);
    await MIGRATIONS.find((migration) => migration.id === 11)!.apply!(db, 11);
    expect(await getSlotsByWeek(1, db)).toHaveLength(2);
    await updateSlot(sourceId, { ...input, servings: 1 }, db);
    expect(await getSlotsByWeek(1, db)).toHaveLength(1);
    await createSlot({ ...input, day: 'wed', kind: 'leftovers', servings: 1, batchSourceUuid: source.uuid }, db);
    await deleteSlot(sourceId, db);
    expect(await getSlotsByWeek(1, db)).toEqual([]);
  } finally {
    sqlite.close();
  }
});
