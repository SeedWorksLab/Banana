import type { SQLiteDatabase } from 'expo-sqlite';
import type { MealType, Slot, WeekDay } from '../models';
import { assertBatchHomeChange, batchCookServings, batchMealDetails, planLeftoverLink } from '../services/batch-cooking-service';
import { mealSettingsForDay, replaceMealSetting } from '../services/meal-settings-service';
import { getDatabase } from './database';
import { createSlot, deleteSlot, getSlotsByWeek, updateSlot, type SlotInput } from './slots';
import { getWeekDayBudgets, setWeekDayMealSettings, upsertWeekDayBudget } from './weekDayBudgets';

export interface LeftoverMealInput {
  weekId: number;
  day: WeekDay;
  mealType: MealType;
  sourceUuid: string;
  servings: number;
  homeId: number | null;
  defaultHomeId: number | null;
}

function slotInput(slot: Slot, servings: number): SlotInput {
  return {
    weekId: slot.weekId, day: slot.day, mealType: slot.mealType, kind: slot.kind,
    recipeId: slot.recipeId, freeText: slot.freeText, servings, note: slot.note,
    pinned: true, sortOrder: slot.sortOrder, batchSourceUuid: slot.batchSourceUuid,
  };
}

export async function setMealLeftovers(input: LeftoverMealInput, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    const slots = await getSlotsByWeek(input.weekId, database);
    const budgets = await getWeekDayBudgets(input.weekId, database);
    const link = planLeftoverLink(slots, budgets, input, input.sourceUuid, input.servings, input.defaultHomeId);
    assertBatchHomeChange(slots.filter((slot) => slot.id !== link.target?.id), budgets,
      input.day, input.homeId, input.defaultHomeId);
    const targetInput: SlotInput = {
      weekId: input.weekId, day: input.day, mealType: input.mealType, kind: 'leftovers',
      recipeId: link.source.recipeId, freeText: null, servings: input.servings,
      note: link.target?.note ?? null, pinned: true, sortOrder: link.target?.sortOrder ?? slots.length,
      batchSourceUuid: link.source.uuid,
    };
    if (link.target) await updateSlot(link.target.id, targetInput, database);
    else await createSlot(targetInput, database);
    await updateSlot(link.source.id, slotInput(link.source, link.sourceServings), database);
    if (link.previousSource && link.previousSourceServings !== null) {
      await updateSlot(link.previousSource.id, slotInput(link.previousSource, link.previousSourceServings), database);
    }
    const budget = budgets.find((entry) => entry.day === input.day);
    await upsertWeekDayBudget({
      weekId: input.weekId, day: input.day, mode: budget?.mode ?? 'cook',
      cookMinutes: budget?.cookMinutes ?? 45, servings: budget?.servings ?? input.servings,
      homeId: input.homeId ?? input.defaultHomeId,
    }, database);
    await setWeekDayMealSettings(input.weekId, input.day, replaceMealSetting(
      mealSettingsForDay(budget ?? { mode: 'cook', cookMinutes: 45 }),
      { mealType: input.mealType, mode: 'leftovers', cookMinutes: 0, enabled: true },
    ), database);
  });
}

export async function unlinkMealLeftovers(weekId: number, slotId: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    const slots = await getSlotsByWeek(weekId, database);
    const slot = slots.find((entry) => entry.id === slotId);
    if (!slot?.batchSourceUuid) return;
    const source = slots.find((entry) => entry.uuid === slot.batchSourceUuid);
    if (slot.cookedAt || source?.cookedAt) throw new Error('This batch is already cooked or eaten. Its reservations cannot be changed.');
    const servings = source ? batchCookServings(batchMealDetails(source, slots).mealServings,
      batchMealDetails(source, slots).leftovers.filter((entry) => entry.id !== slot.id)) : null;
    await deleteSlot(slot.id, database);
    if (source && servings !== null) await updateSlot(source.id, slotInput(source, servings), database);
  });
}
