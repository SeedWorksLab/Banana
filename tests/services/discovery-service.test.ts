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
