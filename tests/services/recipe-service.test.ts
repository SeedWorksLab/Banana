import {
  averageRating,
  computeRatings,
  filterRecipes,
  matchesQuery,
  totalMinutes,
  recipeMealTypes,
  isEatingOut,
  type RecipeSummary,
} from '../../src/services/recipe-service';

function recipe(partial: Partial<RecipeSummary>): RecipeSummary {
  return {
    id: partial.id ?? 1,
    name: partial.name ?? 'Recipe',
    description: partial.description ?? null,
    category: partial.category ?? 'dinner',
    prepMinutes: partial.prepMinutes ?? 10,
    cookMinutes: partial.cookMinutes ?? 20,
    isFavorite: partial.isFavorite ?? false,
    tags: partial.tags ?? [],
  };
}

describe('totalMinutes', () => {
  it('adds prep and cook time', () => {
    expect(totalMinutes({ prepMinutes: 10, cookMinutes: 25 })).toBe(35);
  });
});

describe('averageRating', () => {
  it('rounds to one decimal', () => {
    expect(averageRating([5, 4, 4])).toBe(4.3);
  });

  it('is null for no ratings', () => {
    expect(averageRating([])).toBeNull();
  });
});

describe('computeRatings', () => {
  it('ignores null ratings and aggregates the rest', () => {
    const stats = computeRatings([
      { recipeId: 1, rating: 5 },
      { recipeId: 1, rating: 4 },
      { recipeId: 2, rating: null },
      { recipeId: 2, rating: 3 },
      { recipeId: 3, rating: null },
    ]);
    expect(stats.get(1)).toEqual({ averageRating: 4.5, ratingCount: 2 });
    expect(stats.get(2)).toEqual({ averageRating: 3, ratingCount: 1 });
    expect(stats.has(3)).toBe(false);
  });
});

describe('matchesQuery', () => {
  const pizza = recipe({
    name: 'Margherita Pizza',
    description: 'Classic tomato and mozzarella',
    tags: ['italian', 'veggie'],
  });

  it('matches on name, description and tags, case-insensitively', () => {
    expect(matchesQuery(pizza, 'pizza')).toBe(true);
    expect(matchesQuery(pizza, 'MOZZARELLA')).toBe(true);
    expect(matchesQuery(pizza, 'italian')).toBe(true);
    expect(matchesQuery(pizza, 'sushi')).toBe(false);
  });

  it('matches everything for a blank query', () => {
    expect(matchesQuery(pizza, '   ')).toBe(true);
  });
});

describe('filterRecipes', () => {
  const recipes = [
    recipe({ id: 1, name: 'Quick Pasta', category: 'dinner', prepMinutes: 5, cookMinutes: 10, isFavorite: true, tags: ['italian'] }),
    recipe({ id: 2, name: 'Roast', category: 'dinner', prepMinutes: 20, cookMinutes: 60, tags: ['meat'] }),
    recipe({ id: 3, name: 'Porridge', category: 'breakfast', prepMinutes: 2, cookMinutes: 5, tags: ['veggie'] }),
  ];

  it('filters by max total minutes', () => {
    expect(filterRecipes(recipes, { maxMinutes: 20 }).map((r) => r.id)).toEqual([1, 3]);
  });

  it('filters by category', () => {
    expect(filterRecipes(recipes, { category: 'breakfast' }).map((r) => r.id)).toEqual([3]);
  });

  it('filters favourites only', () => {
    expect(filterRecipes(recipes, { favoriteOnly: true }).map((r) => r.id)).toEqual([1]);
  });

  it('requires every wanted tag', () => {
    expect(filterRecipes(recipes, { tags: ['italian'] }).map((r) => r.id)).toEqual([1]);
    expect(filterRecipes(recipes, { tags: ['italian', 'meat'] })).toEqual([]);
  });

  it('combines query and category', () => {
    expect(filterRecipes(recipes, { query: 'porridge', category: 'breakfast' }).map((r) => r.id)).toEqual([3]);
  });
});
describe('meal tags', () => {
  it('filters a recipe by each of its suitable meals, not just its legacy category', () => {
    const toast = recipe({ tags: ['breakfast', 'lunch', 'dinner'] });
    for (const category of ['breakfast', 'lunch', 'dinner'] as const) {
      expect(filterRecipes([toast], { category })).toEqual([toast]);
    }
    expect(filterRecipes([toast], { category: 'snack' })).toEqual([]);
  });
  it('falls back to the legacy category and accepts multiple explicit meal tags', () => {
    expect(recipeMealTypes({ category: 'dinner', tags: [] })).toEqual(['dinner']);
    expect(recipeMealTypes({ category: 'dinner', tags: ['Breakfast', 'lunch', 'dinner'] }))
      .toEqual(['breakfast', 'lunch', 'dinner']);
    expect(recipeMealTypes({ category: 'dinner', tags: ['breakfast'] })).toEqual(['breakfast']);
  });
  it('recognises the eating-out tag', () => {
    expect(isEatingOut({ tags: ['eating_out'] })).toBe(true);
    expect(isEatingOut({ tags: ['Eating out'] })).toBe(true);
    expect(isEatingOut({ tags: ['comfort'] })).toBe(false);
  });
});
