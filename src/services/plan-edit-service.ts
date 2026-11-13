import type { MealType, Slot, WeekDay } from '../models';

export const DEFAULT_MEAL_TYPE: MealType = 'dinner';

export function slotKey(day: WeekDay, mealType: MealType = DEFAULT_MEAL_TYPE): string {
  return `${day}|${mealType}`;
}

export function slotFor(
  slots: readonly Slot[],
  day: WeekDay,
  mealType: MealType = DEFAULT_MEAL_TYPE
): Slot | null {
  return slots.find((slot) => slot.day === day && slot.mealType === mealType) ?? null;
}

/**
 * A pinned slot is a deliberate user choice, so automatic changes never touch
 * it. Everything else is a Banana suggestion and may be replaced first.
 */
export function isEditableSlot(slot: Slot): boolean {
  return !slot.pinned;
}

export function editableSlotsForDays(
  slots: readonly Slot[],
  days: readonly WeekDay[]
): Slot[] {
  const wanted = new Set(days);
  return slots.filter((slot) => wanted.has(slot.day) && isEditableSlot(slot));
}

export function daysWithMeals(slots: readonly Slot[]): WeekDay[] {
  return [...new Set(slots.filter((slot) => slot.kind !== 'empty').map((slot) => slot.day))];
}

/**
 * The slots that a "cook something else" message should touch. Only the named
 * meal is affected; the rest of the week is left exactly as it was.
 */
export function markCookedTarget(
  slots: readonly Slot[],
  day: WeekDay,
  mealType: MealType = DEFAULT_MEAL_TYPE
): Slot | null {
  return slotFor(slots, day, mealType);
}

export function replacementTargets(
  slots: readonly Slot[],
  days: readonly WeekDay[]
): Slot[] {
  return editableSlotsForDays(slots, days);
}

export function mealSummary(slot: Slot, recipeName: string | null): string {
  if (slot.kind === 'recipe') {
    return recipeName ?? 'Recipe';
  }
  if (slot.kind === 'leftovers') {
    return 'Leftovers';
  }
  if (slot.kind === 'free_text') {
    return slot.freeText ?? 'Meal';
  }
  return 'No meal';
}
