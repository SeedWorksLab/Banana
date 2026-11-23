import type { Recipe, Slot, WeekDayBudget } from '../../src/models';

export function batchRecipe(patch: Partial<Recipe> = {}): Recipe {
  return {
    id: 1, uuid: 'recipe-1', name: 'Curry', description: null, category: 'dinner', source: 'own',
    isBuiltin: false, isFavorite: false, isWish: false, servings: 2, prepMinutes: 10, cookMinutes: 20,
    notes: null, active: true, sortOrder: 0, deleted: false,
    createdAt: '2026-11-23T12:00:00.000Z', updatedAt: '2026-11-23T12:00:00.000Z', ...patch,
  };
}

export function batchSlot(patch: Partial<Slot> = {}): Slot {
  return {
    id: 1, uuid: 'meal-1', weekId: 1, day: 'tue', mealType: 'dinner', kind: 'recipe',
    recipeId: 1, freeText: null, servings: 2, note: null, pinned: false, sortOrder: 0,
    cookedAt: null, rating: null, deleted: false, batchSourceUuid: null,
    createdAt: '2026-11-23T12:00:00.000Z', updatedAt: '2026-11-23T12:00:00.000Z', ...patch,
  };
}

export function batchBudget(patch: Partial<WeekDayBudget> = {}): WeekDayBudget {
  return {
    id: 1, uuid: 'budget-1', weekId: 1, day: 'tue', mode: 'cook', cookMinutes: 45,
    servings: 2, homeId: 1, mealSettings: [],
    createdAt: '2026-11-23T12:00:00.000Z', updatedAt: '2026-11-23T12:00:00.000Z', ...patch,
  };
}
