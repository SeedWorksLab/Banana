import { MEAL_TYPES, WEEK_DAYS, type MealType, type Slot, type WeekDay, type WeekDayBudget } from '../models';
import { mealSettingsForDay } from './meal-settings-service';

export interface BatchCookingPlan {
  sourceDay: WeekDay;
  leftoverDays: WeekDay[];
  cookServings: number;
  mealServings: number;
}

export function planBatchCooking(day: WeekDay, days: number, servings: number): BatchCookingPlan {
  const index = WEEK_DAYS.indexOf(day);
  if (!Number.isInteger(days) || days < 1 || index + days > WEEK_DAYS.length) {
    throw new Error('Choose cooking days within this week.');
  }
  if (!Number.isInteger(servings) || servings < 1) {
    throw new Error('Choose at least one serving per meal.');
  }
  return {
    sourceDay: day,
    leftoverDays: WEEK_DAYS.slice(index + 1, index + days),
    cookServings: servings * days,
    mealServings: servings,
  };
}

export interface BatchMealDetails {
  source: Slot | null;
  leftovers: Slot[];
  mealServings: number;
  cookServings: number;
}

export function batchMealDetails(slot: Slot, slots: readonly Slot[]): BatchMealDetails {
  const source = slot.batchSourceUuid
    ? slots.find((entry) => !entry.deleted && entry.uuid === slot.batchSourceUuid) ?? null
    : slot.kind === 'recipe' ? slot : null;
  const leftovers = source?.uuid
    ? slots.filter((entry) => !entry.deleted && entry.batchSourceUuid === source.uuid)
      .sort((a, b) => mealOrder(a) - mealOrder(b))
    : [];
  return {
    source,
    leftovers,
    mealServings: slot.batchSourceUuid ? slot.servings : slot.servings - leftovers.reduce((sum, entry) => sum + entry.servings, 0),
    cookServings: source?.servings ?? 0,
  };
}

function mealOrder(meal: { day: WeekDay; mealType: MealType }): number {
  return WEEK_DAYS.indexOf(meal.day) * MEAL_TYPES.length + MEAL_TYPES.indexOf(meal.mealType);
}

export interface LeftoverTarget {
  day: WeekDay;
  mealType: MealType;
  homeId: number | null;
}

export function leftoverSources(
  slots: readonly Slot[],
  budgets: readonly WeekDayBudget[],
  target: LeftoverTarget,
  defaultHomeId: number | null,
): Slot[] {
  return slots.filter((slot) => {
    const budget = budgets.find((entry) => entry.day === slot.day);
    const meal = mealSettingsForDay(budget ?? { mode: 'cook', cookMinutes: 45 })
      .find((entry) => entry.mealType === slot.mealType);
    return !slot.deleted && slot.uuid !== null && slot.kind === 'recipe' && slot.recipeId !== null &&
      slot.batchSourceUuid === null && slot.cookedAt === null &&
      !slots.some((entry) => !entry.deleted && entry.batchSourceUuid === slot.uuid && entry.cookedAt !== null) &&
      mealOrder(slot) < mealOrder(target) && meal?.mode === 'cook' && meal.enabled &&
      (budget?.homeId ?? defaultHomeId) === (target.homeId ?? defaultHomeId);
  }).sort((a, b) => mealOrder(b) - mealOrder(a));
}

export function batchCookServings(mealServings: number, leftovers: readonly Pick<Slot, 'servings'>[]): number {
  if (!Number.isInteger(mealServings) || mealServings < 1 ||
      leftovers.some((slot) => !Number.isInteger(slot.servings) || slot.servings < 1)) {
    throw new Error('Choose at least one whole portion for each meal.');
  }
  return mealServings + leftovers.reduce((sum, slot) => sum + slot.servings, 0);
}

export function assertBatchHomeChange(
  slots: readonly Slot[], budgets: readonly WeekDayBudget[], day: WeekDay, homeId: number | null, defaultHomeId: number | null,
): void {
  const home = (value: WeekDay) => value === day ? homeId ?? defaultHomeId
    : budgets.find((budget) => budget.day === value)?.homeId ?? defaultHomeId;
  for (const slot of slots.filter((entry) => !entry.deleted && entry.batchSourceUuid !== null)) {
    const source = slots.find((entry) => !entry.deleted && entry.uuid === slot.batchSourceUuid);
    if (source && (source.day === day || slot.day === day) && home(source.day) !== home(slot.day)) {
      throw new Error('Linked cooking and leftover meals must stay in the same home. Remove or relink the leftovers first.');
    }
  }
}

export interface LeftoverLinkPlan {
  source: Slot;
  target: Slot | null;
  previousSource: Slot | null;
  sourceServings: number;
  previousSourceServings: number | null;
}

export function planLeftoverLink(
  slots: readonly Slot[], budgets: readonly WeekDayBudget[], target: LeftoverTarget,
  sourceUuid: string, servings: number, defaultHomeId: number | null,
): LeftoverLinkPlan {
  if (!Number.isInteger(servings) || servings < 1) throw new Error('Choose at least one leftover portion.');
  const existing = slots.find((entry) => !entry.deleted && entry.day === target.day && entry.mealType === target.mealType) ?? null;
  if (existing?.cookedAt) throw new Error('This meal is already cooked or eaten.');
  if (existing?.uuid && slots.some((entry) => !entry.deleted && entry.batchSourceUuid === existing.uuid)) {
    throw new Error('This meal supplies other leftovers. Remove those links before replacing it.');
  }
  const source = leftoverSources(slots, budgets, target, defaultHomeId).find((entry) => entry.uuid === sourceUuid);
  if (!source) throw new Error('Choose an earlier, uncooked home meal in this week and the same home.');
  const previousSource = existing?.batchSourceUuid
    ? slots.find((entry) => !entry.deleted && entry.uuid === existing.batchSourceUuid) ?? null : null;
  if (previousSource?.cookedAt) throw new Error('The original batch is already cooked. Its reserved portions cannot be changed.');
  const previousSourceServings = previousSource && previousSource.uuid !== sourceUuid
    ? batchCookServings(batchMealDetails(previousSource, slots).mealServings,
      batchMealDetails(previousSource, slots).leftovers.filter((entry) => entry.id !== existing?.id))
    : null;
  const details = batchMealDetails(source, slots);
  return {
    source, target: existing, previousSource, previousSourceServings,
    sourceServings: batchCookServings(details.mealServings,
      [...details.leftovers.filter((entry) => entry.id !== existing?.id), { servings }]),
  };
}
