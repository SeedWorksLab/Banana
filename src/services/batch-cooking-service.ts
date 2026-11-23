import { WEEK_DAYS, type WeekDay } from '../models';

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
