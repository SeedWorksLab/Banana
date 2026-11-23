import { recommendRecipes, type DiscoveryRecipe } from '../../src/services/discovery-service';

function recipe(partial: Partial<DiscoveryRecipe> & { id: number; name: string }): DiscoveryRecipe {
  return {
    id: partial.id,
    name: partial.name,
    category: partial.category ?? 'dinner',
    ingredientIds: partial.ingredientIds ?? [],
    ingredientNames: partial.ingredientNames ?? [],
    onOfferIngredientIds: partial.onOfferIngredientIds ?? [],
    isFavorite: partial.isFavorite ?? false,
    timesCooked: partial.timesCooked ?? 0,
    averageRating: partial.averageRating ?? null,
  };
}

describe('recommendRecipes', () => {
  it('puts a never-cooked recipe above a frequently cooked one', () => {
    const result = recommendRecipes([
      recipe({ id: 1, name: 'Old favourite', timesCooked: 8 }),
      recipe({ id: 2, name: 'Brand new' }),
    ]);
    expect(result.map((item) => item.recipeId)).toEqual([2, 1]);
    expect(result[0].reason).toBe('New to you');
  });

  it('lifts a recipe whose ingredients are on offer', () => {
    const result = recommendRecipes([
      recipe({ id: 1, name: 'A', timesCooked: 1 }),
      recipe({ id: 2, name: 'B', timesCooked: 1, onOfferIngredientIds: [10, 11, 12] }),
    ]);
    expect(result[0].recipeId).toBe(2);
    expect(result[0].reason).toBe('3 ingredients on offer');
  });

  it('keeps favourites in rotation once the novelty fades', () => {
    const result = recommendRecipes([
      recipe({ id: 1, name: 'A', timesCooked: 3 }),
      recipe({ id: 2, name: 'B', timesCooked: 3, isFavorite: true }),
    ]);
    expect(result[0].recipeId).toBe(2);
    expect(result[0].reason).toBe('A favourite to keep in rotation');
  });

  it('drops recipes that contain a disliked ingredient', () => {
    const result = recommendRecipes(
      [
        recipe({ id: 1, name: 'Mushroom pasta', ingredientNames: ['Mushrooms', 'Pasta'] }),
        recipe({ id: 2, name: 'Tomato pasta', ingredientNames: ['Tomato', 'Pasta'] }),
      ],
      { dislikedNames: ['mushrooms'] }
    );
    expect(result.map((item) => item.recipeId)).toEqual([2]);
  });

  it('skips recipes already in the plan and respects the limit', () => {
    const result = recommendRecipes(
      [
        recipe({ id: 1, name: 'A' }),
        recipe({ id: 2, name: 'B' }),
        recipe({ id: 3, name: 'C' }),
      ],
      { skipRecipeIds: [2], limit: 1 }
    );
    expect(result.map((item) => item.recipeId)).toEqual([1]);
  });

  it('is deterministic for equal scores', () => {
    const first = recommendRecipes([
      recipe({ id: 2, name: 'Beta' }),
      recipe({ id: 1, name: 'Alpha' }),
    ]);
    const second = recommendRecipes([
      recipe({ id: 1, name: 'Alpha' }),
      recipe({ id: 2, name: 'Beta' }),
    ]);
    expect(first.map((item) => item.recipeId)).toEqual([1, 2]);
    expect(second.map((item) => item.recipeId)).toEqual([1, 2]);
  });
});

it('rotates equally suitable new suggestions weekly without randomness or catalogue-order bias', () => {
  const recipes = Array.from({ length: 8 }, (_, index) => recipe({ id: index + 1, name: `Recipe ${index + 1}` }));
  const first = recommendRecipes(recipes, { rotationKey: '2026-11-16', limit: 3 });
  expect(first.map((entry) => entry.recipeId)).toEqual([1, 3, 7]);
  expect(recommendRecipes(recipes, { rotationKey: '2026-11-23', limit: 3 }).map((entry) => entry.recipeId)).toEqual([1, 8, 2]);
  expect(recommendRecipes([...recipes].reverse(), { rotationKey: '2026-11-16', limit: 3 })).toEqual(first);
});

it('cools down recently planned recipes that have not been marked cooked', () => {
  const result = recommendRecipes([recipe({ id: 1, name: 'A' }), recipe({ id: 2, name: 'B' })], {
    referenceDate: '2026-11-23',
    recentUses: [{ recipeId: 1, weekStartDate: '2026-11-16', day: 'sun' }],
  });
  expect(result.map((entry) => entry.recipeId)).toEqual([2, 1]);
});

it('diversifies meal types and highly similar dishes within the suggested shortlist', () => {
  const result = recommendRecipes([
    recipe({ id: 1, name: 'A pasta', category: 'dinner', ingredientIds: [1, 2, 3] }),
    recipe({ id: 2, name: 'B pasta', category: 'dinner', ingredientIds: [1, 2, 3] }),
    recipe({ id: 3, name: 'C porridge', category: 'breakfast', ingredientIds: [8, 9] }),
    recipe({ id: 4, name: 'D soup', category: 'dinner', ingredientIds: [10, 11] }),
  ], { limit: 3 });
  expect(result.map((entry) => entry.recipeId)).toEqual([1, 3, 4]);
});

it('derives novelty and ratings from supplied history in the service layer', () => {
  const result = recommendRecipes([
    recipe({ id: 1, name: 'A' }), recipe({ id: 2, name: 'B' }), recipe({ id: 3, name: 'C' }),
  ], { history: [{ recipeId: 1, rating: 5 }, { recipeId: 1, rating: null }] });
  expect(result.map((entry) => entry.recipeId)).toEqual([2, 3, 1]);
  expect(result.find((entry) => entry.recipeId === 1)?.reason).toBe('You rated it 5');
});

it('does not count eating reserved leftovers as cooking the recipe again', () => {
  const result = recommendRecipes([recipe({ id: 1, name: 'Curry' })], {
    history: [
      { recipeId: 1, rating: null, kind: 'recipe' },
      { recipeId: 1, rating: null, kind: 'leftovers' },
      { recipeId: 1, rating: null, kind: 'leftovers' },
    ],
  });
  expect(result[0].score).toBe(15);
});
