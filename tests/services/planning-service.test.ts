import type { WeekDay } from '../../src/models';
import {
  planGap,
  planWeek,
  scoreRecipe,
  type PlannerDay,
  type PlannerRecipe,
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
  };
}

function day(day: WeekDay, mode: PlannerDay['mode'] = 'cook', cookMinutes = 30): PlannerDay {
  return { day, mode, cookMinutes };
}

const WEEK: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

describe('scoreRecipe', () => {
  const context = {
    ratings: new Map<number, number>(),
    usedRecipeIds: new Set<number>(),
    previousCategory: null,
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
});

describe('planWeek', () => {
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
    expect(proposal.slots[0].recipeId).toBe(1);
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

describe('planGap', () => {
  it('fills one day with the best unused recipe', () => {
    const slot = planGap(day('wed'), [recipe({ id: 1 }), recipe({ id: 2, prepMinutes: 1, cookMinutes: 5 })], {
      defaultServings: 2,
      excludeRecipeIds: [1],
    });
    expect(slot.recipeId).toBe(2);
  });
});
