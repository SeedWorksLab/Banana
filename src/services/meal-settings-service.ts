import { MEAL_MODES, MEAL_TYPES, type DayMode, type MealSetting, type MealType } from '../models';
import { recipeMealTypes, isEatingOut } from './recipe-service';

export function parseMealSettings(json: string | null): MealSetting[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value.filter((entry: unknown): entry is MealSetting => {
      if (typeof entry !== 'object' || entry === null) return false;
      const item = entry as Record<string, unknown>;
      return MEAL_TYPES.some((type) => type === item.mealType) &&
        MEAL_MODES.some((mode) => mode === item.mode) &&
        typeof item.cookMinutes === 'number' && Number.isFinite(item.cookMinutes) &&
        item.cookMinutes >= 0 && typeof item.enabled === 'boolean';
    });
  } catch {
    return [];
  }
}

export function mealSettingsForDay(budget: {
  mode: DayMode;
  cookMinutes: number;
  mealSettings?: readonly MealSetting[];
}): MealSetting[] {
  return MEAL_TYPES.map((mealType) => budget.mealSettings?.find((setting) => setting.mealType === mealType) ?? {
    mealType,
    mode: mealType === 'dinner' ? budget.mode : 'cook',
    cookMinutes: budget.cookMinutes,
    enabled: mealType !== 'snack',
  });
}

export function replaceMealSetting(settings: readonly MealSetting[], next: MealSetting): MealSetting[] {
  return [...settings.filter((setting) => setting.mealType !== next.mealType), next];
}

export function allowsRecipeForMeal(
  recipe: { category: MealType; tags: readonly string[] },
  meal: MealSetting
): boolean {
  return meal.enabled && (meal.mode === 'cook' || meal.mode === 'eating_out') &&
    recipeMealTypes(recipe).includes(meal.mealType) &&
    isEatingOut(recipe) === (meal.mode === 'eating_out');
}
