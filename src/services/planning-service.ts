import type { MealType, SlotKind, WeekDay } from '../models';
import { computeRatings, type RatingEntry } from './recipe-service';
import type { PreferenceRecipe } from './preference-service';

export interface PlannerRecipe extends PreferenceRecipe {
  servings: number;
  isFavorite: boolean;
  batchFriendly: boolean;
}

export interface PlannerDay {
  day: WeekDay;
  mode: 'cook' | 'no_cook' | 'leftovers';
  cookMinutes: number;
}

export interface PinnedWish {
  day: WeekDay;
  mealType: MealType;
  recipeId: number | null;
  freeText: string | null;
}

export interface ProposedSlot {
  day: WeekDay;
  mealType: MealType;
  kind: SlotKind;
  recipeId: number | null;
  freeText: string | null;
  servings: number;
  reason: string;
  score: number;
}

export interface PlanWeekInput {
  days: readonly PlannerDay[];
  recipes: readonly PlannerRecipe[];
  history?: readonly RatingEntry[];
  pinned?: readonly PinnedWish[];
  defaultServings: number;
  mealType?: MealType;
}

export interface PlanProposal {
  slots: ProposedSlot[];
  warnings: string[];
}

interface ScoreContext {
  ratings: ReadonlyMap<number, number>;
  usedRecipeIds: ReadonlySet<number>;
  previousCategory: MealType | null;
  defaultServings: number;
}

/**
 * Scores a candidate for one day. Higher is better. The planner is an
 * optimizer, not a randomizer: the score is a pure function of the inputs and
 * the final tie-break is the recipe id, so the same week always plans the same
 * way (AGENTS.md §8).
 *
 * Two objectives beyond "it fits" are explicit:
 *  - variety: a recipe already cooked this week is penalised, and so is a recipe
 *    in the same category as the previous day;
 *  - cook once, eat twice: a batch-friendly recipe earns a bonus, because
 *    leftovers are the cheapest way to gain a cook-free day.
 */
export function scoreRecipe(
  recipe: PlannerRecipe,
  day: PlannerDay,
  context: ScoreContext
): number {
  const total = recipe.prepMinutes + recipe.cookMinutes;
  let score = 0;

  if (total <= day.cookMinutes) {
    score += 20 + Math.min(day.cookMinutes - total, 60) * 0.2;
  } else {
    score -= (total - day.cookMinutes) * 3;
  }

  score += (context.ratings.get(recipe.id) ?? 3) * 4;
  if (context.usedRecipeIds.has(recipe.id)) {
    score -= 25;
  }
  if (recipe.batchFriendly) {
    score += 8;
  }
  if (recipe.isFavorite) {
    score += 2;
  }
  if (context.previousCategory === recipe.category) {
    score -= 3;
  }
  return score;
}

/**
 * Plans one meal per day for a whole week, honouring day modes and pinned
 * wishes. Pinned days are taken first and are excluded from the automatic picks
 * so a wish is never planned twice.
 */
export function planWeek(input: PlanWeekInput): PlanProposal {
  const mealType: MealType = input.mealType ?? 'dinner';
  const history = input.history ?? [];
  const pinned = input.pinned ?? [];

  const ratings = new Map<number, number>();
  for (const [recipeId, stats] of computeRatings(history)) {
    if (stats.averageRating !== null) {
      ratings.set(recipeId, stats.averageRating);
    }
  }

  const recipeById = new Map(input.recipes.map((recipe) => [recipe.id, recipe]));
  const usedRecipeIds = new Set<number>();
  const pinnedByKey = new Map(pinned.map((wish) => [`${wish.day}|${wish.mealType}`, wish]));

  const slots: ProposedSlot[] = [];
  const warnings: string[] = [];
  let previousCategory: MealType | null = null;

  for (const day of input.days) {
    const wish = pinnedByKey.get(`${day.day}|${mealType}`);
    if (wish) {
      if (wish.recipeId !== null) {
        usedRecipeIds.add(wish.recipeId);
        const pinnedRecipe = recipeById.get(wish.recipeId);
        slots.push({
          day: day.day,
          mealType,
          kind: 'recipe',
          recipeId: wish.recipeId,
          freeText: null,
          servings: input.defaultServings,
          reason: 'Pinned by you',
          score: Number.POSITIVE_INFINITY,
        });
        previousCategory = pinnedRecipe?.category ?? previousCategory;
      } else if (wish.freeText && wish.freeText.trim() !== '') {
        slots.push({
          day: day.day,
          mealType,
          kind: 'free_text',
          recipeId: null,
          freeText: wish.freeText.trim(),
          servings: input.defaultServings,
          reason: 'Pinned by you',
          score: Number.POSITIVE_INFINITY,
        });
        previousCategory = null;
      } else {
        slots.push({
          day: day.day,
          mealType,
          kind: 'empty',
          recipeId: null,
          freeText: null,
          servings: 0,
          reason: 'Left blank by you',
          score: Number.POSITIVE_INFINITY,
        });
        previousCategory = null;
      }
      continue;
    }

    if (day.mode === 'no_cook') {
      slots.push({
        day: day.day,
        mealType,
        kind: 'empty',
        recipeId: null,
        freeText: null,
        servings: 0,
        reason: 'No cooking planned',
        score: 0,
      });
      previousCategory = null;
      continue;
    }

    if (day.mode === 'leftovers') {
      slots.push({
        day: day.day,
        mealType,
        kind: 'leftovers',
        recipeId: null,
        freeText: null,
        servings: input.defaultServings,
        reason: 'Leftovers night',
        score: 0,
      });
      previousCategory = null;
      continue;
    }

    const slot = decideCook(day, mealType, input.recipes, {
      ratings,
      usedRecipeIds,
      previousCategory,
      defaultServings: input.defaultServings,
    }, warnings);
    if (slot.recipeId !== null) {
      usedRecipeIds.add(slot.recipeId);
    }
    const chosen = slot.recipeId !== null ? recipeById.get(slot.recipeId) : null;
    previousCategory = chosen?.category ?? previousCategory;
    slots.push(slot);
  }

  return { slots, warnings };
}

function decideCook(
  day: PlannerDay,
  mealType: MealType,
  recipes: readonly PlannerRecipe[],
  context: ScoreContext,
  warnings: string[]
): ProposedSlot {
  if (recipes.length === 0) {
    warnings.push(`No recipes available to cook on ${day.day}.`);
    return {
      day: day.day,
      mealType,
      kind: 'empty',
      recipeId: null,
      freeText: null,
      servings: 0,
      reason: 'No recipes available',
      score: 0,
    };
  }

  const ranked = recipes
    .map((recipe) => ({ recipe, score: scoreRecipe(recipe, day, context) }))
    .sort((a, b) => b.score - a.score || a.recipe.id - b.recipe.id);

  const best = ranked[0];
  const total = best.recipe.prepMinutes + best.recipe.cookMinutes;
  const fits = total <= day.cookMinutes;
  if (!fits) {
    warnings.push(`Nothing fits ${day.day}'s ${day.cookMinutes} min; chose the quickest.`);
  }

  return {
    day: day.day,
    mealType,
    kind: 'recipe',
    recipeId: best.recipe.id,
    freeText: null,
    servings: context.defaultServings,
    reason: fits
      ? `Fits your ${day.cookMinutes} min (about ${total} min)`
      : `Quickest option (${total} min, ${total - day.cookMinutes} over)`,
    score: best.score,
  };
}

/**
 * Fills a single empty cook day without replanning the rest of the week. Used by
 * the tray's "give me something" action.
 */
export function planGap(
  day: PlannerDay,
  recipes: readonly PlannerRecipe[],
  options: {
    mealType?: MealType;
    defaultServings: number;
    history?: readonly RatingEntry[];
    excludeRecipeIds?: readonly number[];
  }
): ProposedSlot {
  const ratings = new Map<number, number>();
  for (const [recipeId, stats] of computeRatings(options.history ?? [])) {
    if (stats.averageRating !== null) {
      ratings.set(recipeId, stats.averageRating);
    }
  }
  const usedRecipeIds = new Set(options.excludeRecipeIds ?? []);
  const warnings: string[] = [];
  return decideCook(
    day,
    options.mealType ?? 'dinner',
    recipes,
    { ratings, usedRecipeIds, previousCategory: null, defaultServings: options.defaultServings },
    warnings
  );
}
