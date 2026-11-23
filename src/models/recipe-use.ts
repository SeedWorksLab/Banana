import type { WeekDay } from './index';

export interface RecipeUse {
  recipeId: number;
  weekStartDate: string;
  day: WeekDay;
}
