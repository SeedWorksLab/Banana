import { buildPlannedMeals } from '../../src/data/selectors';
import { buildShoppingList } from '../../src/services/shopping-list-service';

it('buys a batch once, scaled to include the reserved leftover portion', () => {
  const meals = buildPlannedMeals([
    { id: 1, day: 'tue', kind: 'recipe', recipeId: 1, servings: 2 },
    { id: 2, day: 'wed', kind: 'leftovers', recipeId: 1, servings: 1 },
  ], [{ id: 1, servings: 1 }],
  [{ recipeId: 1, ingredientId: 1, quantity: 150, unit: 'g', optional: false }],
  [{ id: 1, name: 'Rice', category: 'pantry' }]);
  expect(meals).toHaveLength(1);
  expect(buildShoppingList({ meals }).lines[0]).toMatchObject({ quantity: 300, unit: 'g' });
});

it('includes all three home meals in shopping but never restaurant ingredients', () => {
  const meals = buildPlannedMeals(
    [
      { id: 1, day: 'mon', kind: 'recipe', recipeId: 1, servings: 2 },
      { id: 2, day: 'mon', kind: 'recipe', recipeId: 1, servings: 2 },
      { id: 3, day: 'mon', kind: 'recipe', recipeId: 1, servings: 2 },
      { id: 4, day: 'tue', kind: 'recipe', recipeId: 2, servings: 2 },
    ],
    [{ id: 1, servings: 2 }, { id: 2, servings: 2 }],
    [
      { recipeId: 1, ingredientId: 1, quantity: 100, unit: 'g', optional: false },
      { recipeId: 2, ingredientId: 1, quantity: 900, unit: 'g', optional: false },
    ],
    [{ id: 1, name: 'Flour', category: 'pantry' }],
    [], 1, [{ recipeId: 2, tag: 'eating_out' }]
  );
  expect(meals.map((meal) => meal.slotId)).toEqual([1, 2, 3]);
  expect(buildShoppingList({ meals }).lines).toEqual([
    expect.objectContaining({ label: 'Flour', quantity: 300, unit: 'g', homeId: 1 }),
  ]);
});
