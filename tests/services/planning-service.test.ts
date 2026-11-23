import type { WeekDay } from '../../src/models';
import {
  planGap,
  planWeek as planAllMeals,
  scoreRecipe,
  type PlannerDay,
  type PlannerRecipe,
  type PlanWeekInput,
} from '../../src/services/planning-service';

function recipe(partial: Partial<PlannerRecipe>): PlannerRecipe {
  return {
    id: partial.id ?? 1,
    name: partial.name ?? 'Recipe',
    category: partial.category ?? 'dinner',
    prepMinutes: partial.prepMinutes ?? 5,
    cookMinutes: partial.cookMinutes ?? 20,
    ingredientNames: partial.ingredientNames ?? [],
    tags: partial.tags ?? [],
    servings: partial.servings ?? 2,
    isFavorite: partial.isFavorite ?? false,
    batchFriendly: partial.batchFriendly ?? false,
    ingredientIds: partial.ingredientIds,
    ingredientCategories: partial.ingredientCategories,
    stockedIngredientIds: partial.stockedIngredientIds,
    onOfferIngredientIds: partial.onOfferIngredientIds,
  };
}

function day(day: WeekDay, mode: PlannerDay['mode'] = 'cook', cookMinutes = 30): PlannerDay {
  return { day, mode, cookMinutes };
}

const WEEK: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function planWeek(input: PlanWeekInput) {
  return planAllMeals({ ...input, mealType: 'dinner' });
}

describe('scoreRecipe', () => {
  const context = {
    ratings: new Map<number, number>(),
    usedRecipeIds: new Set<number>(),
    usedIngredientIds: new Set<number>(),
    defaultServings: 2,
  };

  it('prefers a recipe that fits the budget', () => {
    const fits = scoreRecipe(recipe({ prepMinutes: 5, cookMinutes: 10 }), day('mon', 'cook', 30), context);
    const overruns = scoreRecipe(recipe({ prepMinutes: 20, cookMinutes: 40 }), day('mon', 'cook', 30), context);
    expect(fits).toBeGreaterThan(overruns);
  });

  it('penalises a recipe already used this week', () => {
    const used = { ...context, usedRecipeIds: new Set([1]) };
    const fresh = scoreRecipe(recipe({ id: 1 }), day('mon'), context);
    const repeat = scoreRecipe(recipe({ id: 1 }), day('mon'), used);
    expect(repeat).toBeLessThan(fresh);
  });

  it('prefers a recipe that reuses ingredients the week already needs', () => {
    const used = { ...context, usedIngredientIds: new Set([10]) };
    const reuses = scoreRecipe(recipe({ ingredientIds: [10, 11] }), day('mon'), used);
    const allNew = scoreRecipe(recipe({ ingredientIds: [20, 21] }), day('mon'), used);
    expect(reuses).toBeGreaterThan(allNew);
  });

  it('prefers a recipe whose ingredients are on offer', () => {
    const onOffer = scoreRecipe(recipe({ onOfferIngredientIds: [1, 2, 3] }), day('mon'), context);
    const fullPrice = scoreRecipe(recipe({ onOfferIngredientIds: [] }), day('mon'), context);
    expect(onOffer).toBeGreaterThan(fullPrice);
  });

  it('prefers a recipe built around fresh produce', () => {
    const fresh = scoreRecipe(
      recipe({ ingredientCategories: ['produce', 'produce', 'pantry'] }),
      day('mon'),
      context
    );
    const heavy = scoreRecipe(
      recipe({ ingredientCategories: ['meat_fish', 'dairy', 'pantry'] }),
      day('mon'),
      context
    );
    expect(fresh).toBeGreaterThan(heavy);
  });

  it('prefers a recipe that uses food already in the pantry', () => {
    const stocked = scoreRecipe(
      recipe({ stockedIngredientIds: [1, 2, 3] }),
      day('mon'),
      context
    );
    const empty = scoreRecipe(recipe({ stockedIngredientIds: [] }), day('mon'), context);
    expect(stocked).toBeGreaterThan(empty);
  });
});

describe('explicit dinner-only planning', () => {
  it('plans exactly one dinner per day', () => {
    const proposal = planWeek({ days: WEEK.map((d) => day(d)), recipes: [recipe({ id: 1 })], defaultServings: 2 });
    expect(proposal.slots).toHaveLength(7);
    expect(proposal.slots.every((s) => s.mealType === 'dinner')).toBe(true);
    expect(proposal.slots.map((s) => s.day)).toEqual(WEEK);
  });

  it('honours no-cook and leftovers days', () => {
    const proposal = planWeek({
      days: [day('mon', 'no_cook', 0), day('tue', 'leftovers', 0)],
      recipes: [recipe({ id: 1 })],
      defaultServings: 2,
    });
    expect(proposal.slots[0].kind).toBe('empty');
    expect(proposal.slots[1].kind).toBe('leftovers');
  });

  it('uses a per-day servings override for planned and pinned meals', () => {
    const proposal = planWeek({
      days: [{ ...day('mon'), servings: 5 }, { ...day('tue'), servings: 3 }],
      recipes: [recipe({ id: 1 }), recipe({ id: 2 })],
      pinned: [{ day: 'tue', mealType: 'dinner', recipeId: 2, freeText: null }],
      defaultServings: 2,
    });
    expect(proposal.slots[0].servings).toBe(5);
    expect(proposal.slots[1].servings).toBe(3);
    expect(proposal.slots[1].reason).toBe('Pinned by you');
  });

  it('falls back to the household servings when a day has none', () => {
    const proposal = planWeek({
      days: [day('mon')],
      recipes: [recipe({ id: 1 })],
      defaultServings: 4,
    });
    expect(proposal.slots[0].servings).toBe(4);
  });

  it('chooses the recipe that fits the day budget', () => {
    const proposal = planWeek({
      days: [day('mon', 'cook', 30)],
      recipes: [recipe({ id: 1, prepMinutes: 5, cookMinutes: 10 }), recipe({ id: 2, prepMinutes: 20, cookMinutes: 40 })],
      defaultServings: 2,
    });
    expect(proposal.slots[0].recipeId).toBe(1);
    expect(proposal.warnings).toEqual([]);
  });

  it('avoids repeating a recipe across the week', () => {
    const proposal = planWeek({
      days: [day('mon', 'cook', 60), day('tue', 'cook', 60)],
      recipes: [recipe({ id: 1 }), recipe({ id: 2 })],
      defaultServings: 2,
    });
    expect(proposal.slots.map((s) => s.recipeId)).toEqual([1, 2]);
  });

  it('reuses ingredients across days to keep the list short', () => {
    const proposal = planWeek({
      days: [day('mon', 'cook', 60), day('tue', 'cook', 60)],
      recipes: [
        recipe({ id: 1, ingredientIds: [10] }),
        recipe({ id: 2, ingredientIds: [10, 11] }),
        recipe({ id: 3, ingredientIds: [20, 21] }),
      ],
      defaultServings: 2,
    });
    expect(proposal.slots.map((s) => s.recipeId)).toEqual([1, 2]);
  });

  it('respects a pinned recipe and does not reuse it automatically', () => {
    const proposal = planWeek({
      days: [day('mon'), day('tue')],
      recipes: [recipe({ id: 1 }), recipe({ id: 2 })],
      pinned: [{ day: 'mon', mealType: 'dinner', recipeId: 1, freeText: null }],
      defaultServings: 2,
    });
    expect(proposal.slots[0].recipeId).toBe(1);
    expect(proposal.slots[0].reason).toBe('Pinned by you');
    expect(proposal.slots[1].recipeId).toBe(2);
  });

  it('keeps pinned free text', () => {
    const proposal = planWeek({
      days: [day('mon')],
      recipes: [recipe({ id: 1 })],
      pinned: [{ day: 'mon', mealType: 'dinner', recipeId: null, freeText: 'Takeaway' }],
      defaultServings: 2,
    });
    expect(proposal.slots[0]).toMatchObject({ kind: 'free_text', freeText: 'Takeaway' });
  });

  it('warns when nothing fits the budget', () => {
    const proposal = planWeek({
      days: [day('mon', 'cook', 10)],
      recipes: [recipe({ id: 1, prepMinutes: 20, cookMinutes: 40 })],
      defaultServings: 2,
    });
    expect(proposal.warnings).toHaveLength(1);
    expect(proposal.slots[0].recipeId).toBeNull();
    expect(proposal.slots[0].kind).toBe('empty');
  });

  it('is deterministic for identical input', () => {
    const input = {
      days: WEEK.map((d) => day(d)),
      recipes: [recipe({ id: 1 }), recipe({ id: 2, prepMinutes: 10, cookMinutes: 25 }), recipe({ id: 3 })],
      defaultServings: 2,
    };
    expect(planWeek(input)).toEqual(planWeek(input));
  });
});

describe('three-meal planning', () => {
  const cookbook = [
    recipe({ id: 1, name: 'Porridge', category: 'breakfast', prepMinutes: 5, cookMinutes: 5 }),
    recipe({ id: 2, name: 'Soup', category: 'lunch', prepMinutes: 10, cookMinutes: 10 }),
    recipe({ id: 3, name: 'Curry', category: 'dinner', prepMinutes: 10, cookMinutes: 20 }),
    recipe({ id: 4, name: 'Pizza place', category: 'dinner', tags: ['lunch', 'dinner', 'eating_out'], prepMinutes: 0, cookMinutes: 0 }),
    recipe({ id: 5, name: 'Apple', category: 'snack', prepMinutes: 0, cookMinutes: 0 }),
  ];

  it('plans 21 appropriate meals in a week with no default snacks or restaurants', () => {
    const input = { days: WEEK.map((d) => day(d)), recipes: cookbook, defaultServings: 2 };
    const proposal = planAllMeals(input);
    expect(proposal.slots).toHaveLength(21);
    for (const d of WEEK) {
      expect(proposal.slots.filter((slot) => slot.day === d).map((slot) => [slot.mealType, slot.recipeId])).toEqual([
        ['breakfast', 1], ['lunch', 2], ['dinner', 3],
      ]);
    }
    expect(planAllMeals(input)).toEqual(proposal);
  });

  it('uses independent meal times, and restaurants only at the requested meal', () => {
    const proposal = planAllMeals({
      days: [{
        ...day('mon'), mealSettings: [
          { mealType: 'breakfast', mode: 'cook', cookMinutes: 10, enabled: true },
          { mealType: 'lunch', mode: 'eating_out', cookMinutes: 0, enabled: true },
          { mealType: 'dinner', mode: 'cook', cookMinutes: 30, enabled: true },
          { mealType: 'snack', mode: 'cook', cookMinutes: 5, enabled: true },
        ],
      }],
      recipes: cookbook, defaultServings: 2,
    });
    expect(proposal.slots.map((slot) => [slot.mealType, slot.recipeId])).toEqual([
      ['breakfast', 1], ['lunch', 4], ['dinner', 3], ['snack', 5],
    ]);
  });

  it('keeps a gap rather than using dinner for breakfast or overrunning a meal time limit', () => {
    const proposal = planAllMeals({
      days: [{ ...day('mon'), mealSettings: [{ mealType: 'breakfast', mode: 'cook', cookMinutes: 2, enabled: true }] }],
      recipes: cookbook, defaultServings: 2,
    });
    expect(proposal.slots[0]).toMatchObject({ mealType: 'breakfast', kind: 'empty', recipeId: null });
    expect(proposal.slots[1].recipeId).toBe(2);
    expect(proposal.slots[2].recipeId).toBe(3);
  });

  it('uses a multi-meal recipe for all its tagged meal types', () => {
    const proposal = planAllMeals({
      days: [day('mon')], defaultServings: 2,
      recipes: [recipe({ id: 9, category: 'dinner', tags: ['breakfast', 'lunch', 'dinner'] })],
    });
    expect(proposal.slots.map((slot) => slot.recipeId)).toEqual([9, 9, 9]);
  });

  it('does not let an incompatible pinned restaurant bypass the eating-out gate', () => {
    const proposal = planAllMeals({
      days: [day('mon')], recipes: cookbook, defaultServings: 2,
      pinned: [{ day: 'mon', mealType: 'lunch', recipeId: 4, freeText: null }],
    });
    expect(proposal.slots.find((slot) => slot.mealType === 'lunch')?.recipeId).toBe(2);
  });
});

describe('planGap', () => {
  it('honours one meal’s no-cook, leftovers and eating-out modes', () => {
    const recipes = [recipe({ id: 1 }), recipe({ id: 2, tags: ['dinner', 'eating_out'], prepMinutes: 0, cookMinutes: 0 })];
    expect(planGap(day('mon', 'no_cook'), recipes, { defaultServings: 2 }).kind).toBe('empty');
    expect(planGap(day('mon', 'leftovers'), recipes, { defaultServings: 2 }).kind).toBe('leftovers');
    expect(planGap(day('mon', 'eating_out'), recipes, { defaultServings: 2 }).recipeId).toBe(2);
  });
  it('fills one day with the best unused recipe', () => {
    const slot = planGap(day('wed'), [recipe({ id: 1 }), recipe({ id: 2, prepMinutes: 1, cookMinutes: 5 })], {
      defaultServings: 2,
      excludeRecipeIds: [1],
    });
    expect(slot.recipeId).toBe(2);
  });
});

describe('recipe variety and rotation', () => {
  const boosted = recipe({
    id: 1, isFavorite: true, batchFriendly: true,
    ingredientIds: [1, 2, 3, 4, 5], stockedIngredientIds: [1, 2, 3, 4, 5],
    onOfferIngredientIds: [1, 2, 3, 4, 5], ingredientCategories: ['produce', 'produce', 'produce', 'produce', 'produce'],
  });

  it('uses seven suitable recipes once each even when pantry, offers and expiry strongly favour one', () => {
    const result = planWeek({
      days: WEEK.map((value) => ({ ...day(value), expiringIngredientIds: [1, 2, 3, 4, 5] })),
      recipes: [boosted, ...[2, 3, 4, 5, 6, 7].map((id) => recipe({ id }))],
      history: [{ recipeId: 1, rating: 5 }], defaultServings: 2,
    });
    expect(result.slots.map((slot) => slot.recipeId)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result.warnings).toEqual([]);
  });

  it('balances unavoidable repeats instead of recommending the same boosted dish every day', () => {
    const result = planWeek({
      days: WEEK.map((value) => day(value)), recipes: [boosted, recipe({ id: 2 }), recipe({ id: 3 })], defaultServings: 2,
    });
    expect(result.slots.map((slot) => slot.recipeId)).toEqual([1, 2, 3, 1, 2, 3, 1]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('not enough different recipes');
  });

  it('does not let ingredient-reuse rewards fill consecutive meals with near-identical dishes', () => {
    const result = planWeek({
      days: [day('mon'), day('tue'), day('wed')],
      recipes: [
        recipe({ id: 1, name: 'Pasta A', ingredientIds: [1, 2, 3] }),
        recipe({ id: 2, name: 'Pasta B', ingredientIds: [1, 2, 3] }),
        recipe({ id: 3, name: 'Curry', ingredientIds: [4, 5, 6] }),
      ], defaultServings: 2,
    });
    expect(result.slots.map((slot) => slot.recipeId)).toEqual([1, 3, 2]);
  });

  it('reserves a future pinned meal before assigning earlier automatic meals', () => {
    const result = planWeek({
      days: [day('mon'), day('tue'), day('wed')], recipes: [boosted, recipe({ id: 2 }), recipe({ id: 3 })],
      pinned: [{ day: 'tue', mealType: 'dinner', recipeId: 1, freeText: null }], defaultServings: 2,
    });
    expect(result.slots.map((slot) => slot.recipeId)).toEqual([2, 1, 3]);
    expect(result.slots[1].reason).toBe('Pinned by you');
  });

  it('allocates the only quick recipe to the tight day before choosing for a flexible day', () => {
    const result = planWeek({
      days: [day('mon', 'cook', 60), day('tue', 'cook', 10)],
      recipes: [{ ...boosted, prepMinutes: 0, cookMinutes: 5 }, recipe({ id: 2, prepMinutes: 5, cookMinutes: 35 })],
      defaultServings: 2,
    });
    expect(result.slots.map((slot) => slot.recipeId)).toEqual([2, 1]);
    expect(result.slots.map((slot) => slot.day)).toEqual(['mon', 'tue']);
  });

  it('avoids the previous week’s planned dishes even without cooking or rating records', () => {
    const result = planWeek({
      days: WEEK.map((value) => day(value)),
      recipes: Array.from({ length: 14 }, (_, index) => recipe({ id: index + 1 })),
      weekStartDate: '2026-11-23',
      recentUses: WEEK.map((value, index) => ({ recipeId: index + 1, weekStartDate: '2026-11-16', day: value })),
      defaultServings: 2,
    });
    expect(result.slots.map((slot) => slot.recipeId).sort((a, b) => a! - b!)).toEqual([8, 9, 10, 11, 12, 13, 14]);
  });

  it('breaks equal-score ties by week rather than always by low id, independently of catalogue ordering', () => {
    const cookbook = Array.from({ length: 8 }, (_, index) => recipe({ id: index + 1 }));
    const input = { days: WEEK.map((value) => day(value)), recipes: cookbook, defaultServings: 2 };
    const first = planWeek({ ...input, weekStartDate: '2026-11-16' });
    const second = planWeek({ ...input, weekStartDate: '2026-11-23' });
    expect(first.slots.map((slot) => slot.recipeId)).toEqual([1, 3, 7, 6, 8, 2, 5]);
    expect(second.slots.map((slot) => slot.recipeId)).toEqual([1, 8, 2, 3, 7, 6, 5]);
    expect(planWeek({ ...input, recipes: [...cookbook].reverse(), weekStartDate: '2026-11-16' })).toEqual(first);
    expect(cookbook.map((entry) => entry.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('counts untouched cooking meals during partial replanning, but not intentional leftover reservations', () => {
    const result = planWeek({
      days: [day('fri')], recipes: [recipe({ id: 1 }), recipe({ id: 2 })], existingRecipeIds: [2, 2],
      pinned: [
        { day: 'mon', mealType: 'dinner', recipeId: 1, freeText: null, kind: 'recipe' },
        { day: 'tue', mealType: 'dinner', recipeId: 1, freeText: null, kind: 'leftovers' },
        { day: 'wed', mealType: 'dinner', recipeId: 1, freeText: null, kind: 'leftovers' },
      ], defaultServings: 2,
    });
    expect(result.slots[0].recipeId).toBe(1);
  });

  it.each(['leftovers', 'cook'] as const)('keeps explicitly linked leftovers when the budget mode is %s', (mode) => {
    const result = planWeek({
      days: [day('tue', mode, 30)], recipes: [recipe({ id: 1 })],
      pinned: [{ day: 'tue', mealType: 'dinner', recipeId: 1, freeText: null, kind: 'leftovers' }],
      defaultServings: 2,
    });
    expect(result.slots[0]).toMatchObject({ kind: 'leftovers', recipeId: 1, reason: 'Leftovers reserved by you' });
  });

  it('does not give a blanket advantage to batch-friendly tags without an actual batch reservation', () => {
    const context = { ratings: new Map<number, number>(), usedRecipeIds: new Set<number>(),
      usedIngredientIds: new Set<number>(), defaultServings: 2 };
    expect(scoreRecipe(recipe({ batchFriendly: true }), day('mon'), context))
      .toBe(scoreRecipe(recipe({ batchFriendly: false }), day('mon'), context));
    expect(scoreRecipe(recipe({ id: 1 }), day('mon'), { ...context, recipeUseCounts: new Map([[1, 3]]) }))
      .toBeLessThan(scoreRecipe(recipe({ id: 1 }), day('mon'), { ...context, recipeUseCounts: new Map([[1, 1]]) }));
  });

  it('applies recent rotation and a genuine unused-first preference to gap recommendations', () => {
    expect(planGap(day('wed'), [boosted, recipe({ id: 2 })],
      { defaultServings: 2, excludeRecipeIds: [1] }).recipeId).toBe(2);
    expect(planGap(day('wed'), [recipe({ id: 1 }), recipe({ id: 2 })], {
      defaultServings: 2, weekStartDate: '2026-11-23',
      recentUses: [{ recipeId: 1, weekStartDate: '2026-11-16', day: 'sun' }],
    }).recipeId).toBe(2);
  });
});
