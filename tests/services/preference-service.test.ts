import {
  budgetRemainingCents,
  budgetStatus,
  containsAllergen,
  filterRecipesForPreferences,
  isDisliked,
  isRecipeAllowed,
  isWithinBudget,
  normalizeTerm,
  satisfiesDiet,
  type PreferenceRecipe,
} from '../../src/services/preference-service';

function recipe(partial: Partial<PreferenceRecipe>): PreferenceRecipe {
  return {
    id: partial.id ?? 1,
    name: partial.name ?? 'Recipe',
    category: partial.category ?? 'dinner',
    prepMinutes: partial.prepMinutes ?? 10,
    cookMinutes: partial.cookMinutes ?? 20,
    ingredientNames: partial.ingredientNames ?? [],
    tags: partial.tags ?? [],
  };
}

describe('normalizeTerm', () => {
  it('trims and lowercases', () => {
    expect(normalizeTerm('  Peanut  ')).toBe('peanut');
  });
});

describe('containsAllergen', () => {
  const pb = recipe({ ingredientNames: ['Peanut butter', 'Bread'] });

  it('matches an allergen inside an ingredient name', () => {
    expect(containsAllergen(pb, ['peanut'])).toBe(true);
  });

  it('is false when no ingredient matches', () => {
    expect(containsAllergen(pb, ['milk'])).toBe(false);
  });
});

describe('isDisliked', () => {
  it('matches the recipe name', () => {
    expect(isDisliked(recipe({ name: 'Liver and onions' }), ['liver'])).toBe(true);
  });
});

describe('satisfiesDiet', () => {
  it('lets omnivores eat anything', () => {
    expect(satisfiesDiet(recipe({ tags: ['meat'] }), 'omnivore')).toBe(true);
  });

  it('blocks forbidden tags per diet', () => {
    expect(satisfiesDiet(recipe({ tags: ['fish'] }), 'vegetarian')).toBe(false);
    expect(satisfiesDiet(recipe({ tags: ['dairy'] }), 'vegan')).toBe(false);
    expect(satisfiesDiet(recipe({ tags: ['meat'] }), 'pescatarian')).toBe(false);
  });

  it('allows compliant recipes', () => {
    expect(satisfiesDiet(recipe({ tags: ['veggie'] }), 'vegan')).toBe(true);
  });
});

describe('isRecipeAllowed', () => {
  const context = { diet: 'vegetarian' as const, allergies: ['peanut'], dislikes: ['liver'] };

  it('rejects an allergen first', () => {
    expect(isRecipeAllowed(recipe({ tags: ['veggie'], ingredientNames: ['Peanut'] }), context)).toBe(false);
  });

  it('rejects a disliked recipe', () => {
    expect(isRecipeAllowed(recipe({ tags: ['veggie'], name: 'Liver stew' }), context)).toBe(false);
  });

  it('rejects a diet violation', () => {
    expect(isRecipeAllowed(recipe({ tags: ['fish'] }), context)).toBe(false);
  });

  it('accepts a compliant recipe', () => {
    expect(isRecipeAllowed(recipe({ tags: ['veggie'], name: 'Bean stew' }), context)).toBe(true);
  });
});

describe('filterRecipesForPreferences', () => {
  it('keeps only allowed recipes', () => {
    const recipes = [
      recipe({ id: 1, tags: ['veggie'], name: 'Bean stew' }),
      recipe({ id: 2, tags: ['meat'], name: 'Steak' }),
    ];
    const allowed = filterRecipesForPreferences(recipes, { diet: 'vegetarian', allergies: [], dislikes: [] });
    expect(allowed.map((r) => r.id)).toEqual([1]);
  });
});

describe('budget helpers', () => {
  it('reports saving when under budget', () => {
    expect(budgetStatus(5000, 10000)).toBe('saving');
    expect(isWithinBudget(10000, 10000)).toBe(true);
  });

  it('reports pricey when over budget', () => {
    expect(budgetStatus(12000, 10000)).toBe('pricey');
    expect(isWithinBudget(12001, 10000)).toBe(false);
  });

  it('computes the remaining cents', () => {
    expect(budgetRemainingCents(4000, 10000)).toBe(6000);
    expect(budgetRemainingCents(12000, 10000)).toBe(-2000);
  });
});
