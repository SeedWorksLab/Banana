import { allowsRecipeForMeal, mealSettingsForDay, parseMealSettings, replaceMealSetting } from '../../src/services/meal-settings-service';
import type { MealSetting } from '../../src/models';

const lunch: MealSetting = { mealType: 'lunch', mode: 'eating_out', cookMinutes: 0, enabled: true };

it('defaults to three enabled main meals and a disabled snack, preserving the old dinner setting', () => {
  expect(mealSettingsForDay({ mode: 'leftovers', cookMinutes: 30 })).toEqual([
    { mealType: 'breakfast', mode: 'cook', cookMinutes: 30, enabled: true },
    { mealType: 'lunch', mode: 'cook', cookMinutes: 30, enabled: true },
    { mealType: 'dinner', mode: 'leftovers', cookMinutes: 30, enabled: true },
    { mealType: 'snack', mode: 'cook', cookMinutes: 30, enabled: false },
  ]);
});

it('changes only the selected meal and validates stored settings', () => {
  const defaults = mealSettingsForDay({ mode: 'cook', cookMinutes: 45 });
  const changed = replaceMealSetting(defaults, lunch);
  expect(changed.find((entry) => entry.mealType === 'dinner')).toEqual(defaults[2]);
  expect(parseMealSettings(JSON.stringify(changed))).toEqual(changed);
  expect(mealSettingsForDay({ mode: 'cook', cookMinutes: 45, mealSettings: changed })[1]).toEqual(lunch);
  expect(parseMealSettings('invalid')).toEqual([]);
  expect(parseMealSettings(null)).toEqual([]);
  expect(parseMealSettings('{}')).toEqual([]);
  expect(parseMealSettings('[{"mealType":"snack","mode":"invalid","cookMinutes":-1,"enabled":true}]')).toEqual([]);
});

it('allows restaurants only for explicitly enabled eating-out meals and respects meal tags', () => {
  const restaurant = { category: 'dinner' as const, tags: ['lunch', 'dinner', 'eating_out'] };
  expect(allowsRecipeForMeal(restaurant, lunch)).toBe(true);
  expect(allowsRecipeForMeal(restaurant, { ...lunch, mode: 'cook' })).toBe(false);
  expect(allowsRecipeForMeal(restaurant, { ...lunch, mode: 'no_cook' })).toBe(false);
  expect(allowsRecipeForMeal(restaurant, { ...lunch, mode: 'leftovers' })).toBe(false);
  expect(allowsRecipeForMeal(restaurant, { ...lunch, mealType: 'breakfast' })).toBe(false);
  expect(allowsRecipeForMeal(restaurant, { ...lunch, enabled: false })).toBe(false);
  expect(allowsRecipeForMeal({ category: 'lunch', tags: [] }, lunch)).toBe(false);
});
