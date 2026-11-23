import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { setMealLeftovers, unlinkMealLeftovers } from '../../src/database/batch-meals';
import { createSlot, getSlotsByWeek, markSlotCooked, updateSlot } from '../../src/database/slots';
import { getWeekDayBudgets, setWeekDayMealSettings } from '../../src/database/weekDayBudgets';
import { buildPlannedMeals } from '../../src/data/selectors';
import { buildShoppingList } from '../../src/services/shopping-list-service';

let sqlite: DatabaseSync;
let db: SQLiteDatabase;
let sourceUuid: string;
let otherUuid: string;
let failBudgetWrite = false;
const input = { weekId: 1, day: 'wed' as const, mealType: 'lunch' as const,
  servings: 2, homeId: 1, defaultHomeId: 1 };

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:');
  failBudgetWrite = false;
  db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    runAsync: async (sql: string, params: (string | number | null)[] = []) => {
      if (failBudgetWrite && sql.includes('UPDATE week_day_budgets SET meal_settings')) throw new Error('Disk full');
      const result = sqlite.prepare(sql).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getFirstAsync: async (sql: string, params: (string | number | null)[] = []) => sqlite.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: (string | number | null)[] = []) => sqlite.prepare(sql).all(...params),
    withTransactionAsync: async (fn: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try { await fn(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as SQLiteDatabase;
  for (const migration of MIGRATIONS) {
    if (migration.sql) await db.execAsync(migration.sql);
    await migration.apply?.(db, 0);
  }
  sqlite.exec(`
    INSERT INTO weeks (id, week_start_date, status) VALUES (1, '2026-11-23', 'planning');
    INSERT INTO recipes (id, name, category) VALUES (1, 'Curry', 'dinner'), (2, 'Soup', 'lunch');
    INSERT INTO week_day_budgets (week_id, day, mode, cook_minutes, servings, home_id)
      VALUES (1, 'mon', 'cook', 30, 2, 1), (1, 'tue', 'cook', 45, 2, 1), (1, 'wed', 'cook', 30, 2, 1);
  `);
  const base = { weekId: 1, kind: 'recipe' as const, recipeId: 1, freeText: null, servings: 2,
    note: null, sortOrder: 0 };
  await createSlot({ ...base, day: 'tue', mealType: 'dinner' }, db);
  await createSlot({ ...base, recipeId: 2, day: 'mon', mealType: 'lunch', sortOrder: 1 }, db);
  const slots = await getSlotsByWeek(1, db);
  sourceUuid = slots[0].uuid!;
  otherUuid = slots[1].uuid!;
});
afterEach(() => sqlite.close());

it('persists explicit cross-meal links, preserves other meal settings and buys a batch once', async () => {
  await setWeekDayMealSettings(1, 'wed', [{ mealType: 'dinner', mode: 'eating_out', cookMinutes: 0, enabled: true }], db);
  await setMealLeftovers({ ...input, sourceUuid }, db);
  const slots = await getSlotsByWeek(1, db);
  expect(slots.find((slot) => slot.uuid === sourceUuid)).toMatchObject({ servings: 4, pinned: true });
  expect(slots.find((slot) => slot.day === 'wed')).toMatchObject({
    kind: 'leftovers', mealType: 'lunch', recipeId: 1, servings: 2, batchSourceUuid: sourceUuid, pinned: true,
  });
  expect((await getWeekDayBudgets(1, db)).find((budget) => budget.day === 'wed')?.mealSettings).toEqual(expect.arrayContaining([
    { mealType: 'lunch', mode: 'leftovers', cookMinutes: 0, enabled: true },
    { mealType: 'dinner', mode: 'eating_out', cookMinutes: 0, enabled: true },
  ]));
  const meals = buildPlannedMeals(slots, [{ id: 1, servings: 2 }],
    [{ recipeId: 1, ingredientId: 1, quantity: 200, unit: 'g', optional: false }],
    [{ id: 1, name: 'Rice', category: 'pantry' }]);
  expect(buildShoppingList({ meals }).lines[0]).toMatchObject({ label: 'Rice', quantity: 400, unit: 'g' });
});

it('keeps non-consecutive reservations when resizing, relinking and removing another reservation', async () => {
  await setMealLeftovers({ ...input, sourceUuid }, db);
  await setMealLeftovers({ ...input, day: 'fri', mealType: 'dinner', servings: 1, sourceUuid }, db);
  await setMealLeftovers({ ...input, servings: 1, sourceUuid }, db);
  let slots = await getSlotsByWeek(1, db);
  expect(slots.find((slot) => slot.uuid === sourceUuid)?.servings).toBe(4);
  expect(slots.filter((slot) => slot.batchSourceUuid === sourceUuid)).toHaveLength(2);
  await setMealLeftovers({ ...input, servings: 1, sourceUuid: otherUuid }, db);
  slots = await getSlotsByWeek(1, db);
  expect(slots.find((slot) => slot.uuid === sourceUuid)?.servings).toBe(3);
  expect(slots.find((slot) => slot.uuid === otherUuid)?.servings).toBe(3);
  expect(slots.find((slot) => slot.day === 'wed')).toMatchObject({ recipeId: 2, batchSourceUuid: otherUuid });
  await unlinkMealLeftovers(1, slots.find((slot) => slot.day === 'wed')!.id, db);
  slots = await getSlotsByWeek(1, db);
  expect(slots.find((slot) => slot.uuid === otherUuid)?.servings).toBe(2);
  expect(slots.find((slot) => slot.day === 'fri')).toMatchObject({ batchSourceUuid: sourceUuid, servings: 1 });
});

it('rolls back source, reservation and budget changes if a write fails', async () => {
  const before = await getSlotsByWeek(1, db);
  const budgets = await getWeekDayBudgets(1, db);
  failBudgetWrite = true;
  await expect(setMealLeftovers({ ...input, sourceUuid }, db)).rejects.toThrow('Disk full');
  expect(await getSlotsByWeek(1, db)).toEqual(before);
  expect(await getWeekDayBudgets(1, db)).toEqual(budgets);
});

it('protects cooked batches and eaten reservations without changing the existing plan', async () => {
  await setMealLeftovers({ ...input, sourceUuid }, db);
  const source = (await getSlotsByWeek(1, db)).find((slot) => slot.uuid === sourceUuid)!;
  await markSlotCooked(source.id, null, db);
  const before = await getSlotsByWeek(1, db);
  await expect(setMealLeftovers({ ...input, servings: 3, sourceUuid }, db)).rejects.toThrow('earlier, uncooked');
  await expect(unlinkMealLeftovers(1, before.find((slot) => slot.day === 'wed')!.id, db)).rejects.toThrow('already cooked');
  expect(await getSlotsByWeek(1, db)).toEqual(before);
});

it('migration 14 preserves existing links and retains them during valid source-portion updates', async () => {
  await setMealLeftovers({ ...input, sourceUuid }, db);
  const slots = await getSlotsByWeek(1, db);
  await db.execAsync(MIGRATIONS.find((migration) => migration.id === 14)!.sql);
  expect(await getSlotsByWeek(1, db)).toEqual(slots);
  const source = slots.find((slot) => slot.uuid === sourceUuid)!;
  await updateSlot(source.id, { ...source, servings: 5 }, db);
  expect((await getSlotsByWeek(1, db)).find((slot) => slot.day === 'wed')?.batchSourceUuid).toBe(sourceUuid);
});
