import { MAIN_MEAL_TYPES, type IngredientCategory, type MealMode, type MealSetting, type MealType, type SlotKind, type WeekDay } from '../models';
import { computeRatings, isEatingOut, recipeMealTypes, type RatingEntry } from './recipe-service';
import { allowsRecipeForMeal } from './meal-settings-service';
import type { PreferenceRecipe } from './preference-service';
import type { RecipeUse } from '../models/recipe-use';
import { recipeRecencyPenalties, recipeRotationRank } from './recipe-rotation-service';

export interface PlannerRecipe extends PreferenceRecipe {
  servings: number;
  isFavorite: boolean;
  batchFriendly: boolean;
  ingredientIds?: readonly number[];
  ingredientCategories?: readonly IngredientCategory[];
  stockedIngredientIds?: readonly number[];
  onOfferIngredientIds?: readonly number[];
}

export interface PlannerDay {
  day: WeekDay;
  mode: MealMode;
  cookMinutes: number;
  servings?: number;
  homeId?: number | null;
  expiringIngredientIds?: readonly number[];
  mealSettings?: readonly MealSetting[];
}

export interface PinnedWish {
  day: WeekDay;
  mealType: MealType;
  recipeId: number | null;
  freeText: string | null;
  kind?: SlotKind;
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
  weekStartDate?: string;
  recentUses?: readonly RecipeUse[];
  existingRecipeIds?: readonly number[];
}

export interface PlanProposal {
  slots: ProposedSlot[];
  warnings: string[];
}

interface ScoreContext {
  ratings: ReadonlyMap<number, number>;
  usedRecipeIds: ReadonlySet<number>;
  usedIngredientIds: ReadonlySet<number>;
  defaultServings: number;
  recipeUseCounts?: ReadonlyMap<number, number>;
  recencyPenalties?: ReadonlyMap<number, number>;
  rotationKey?: string;
  chosenIngredientSets?: readonly ReadonlySet<number>[];
}

/**
 * Scores a candidate for one day. Higher is better. The planner is an
 * optimizer, not a randomizer: the score is a pure function of the inputs and
 * weekly rotation only breaks ties, so the same inputs always plan the same
 * way (AGENTS.md §8).
 *
 * Objectives beyond "it fits" are explicit:
 *  - variety: a recipe already cooked this week is penalised, and so is a recipe
 *    with increasing penalties for repeated cooking;
 *  - short trips: a recipe reusing ingredients the week already needs, or using
 *    ingredients that are on offer, is rewarded so the list stays small;
 *  - variety and health: a recipe built around more fresh produce scores higher,
 *    so an all-meat week never wins on time or price alone;
 *  - use what is in the house: ingredients already stocked in the pantry are
 *    rewarded, so the plan starts from food that would otherwise be wasted;
 * Explicit batches are reserved by the user; a batch-friendly tag alone must
 * not keep a recipe at the top of every automatic plan.
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
  const uses = context.recipeUseCounts?.get(recipe.id) ?? (context.usedRecipeIds.has(recipe.id) ? 1 : 0);
  score -= uses * 25;
  score -= context.recencyPenalties?.get(recipe.id) ?? 0;
  if (recipe.isFavorite) {
    score += 2;
  }

  const ingredientIds = recipe.ingredientIds ?? [];
  const reused = ingredientIds.filter((id) => context.usedIngredientIds.has(id)).length;
  if (reused > 0) {
    score += Math.min(reused, 5) * 4;
  }
  const uniqueIngredients = new Set(ingredientIds);
  if (uniqueIngredients.size >= 3) {
    const nearDuplicates = (context.chosenIngredientSets ?? []).filter((previous) => {
      const overlap = [...uniqueIngredients].filter((id) => previous.has(id)).length;
      const union = new Set([...uniqueIngredients, ...previous]).size;
      return previous.size >= 3 && overlap / union >= 0.8;
    }).length;
    score -= Math.min(nearDuplicates, 2) * 24;
  }
  const onOffer = recipe.onOfferIngredientIds?.length ?? 0;
  if (onOffer > 0) {
    score += Math.min(onOffer, 5) * 3;
  }

  const produce = (recipe.ingredientCategories ?? []).filter(
    (category) => category === 'produce'
  ).length;
  if (produce > 0) {
    score += Math.min(produce, 5) * 1.5;
  }

  const stocked = recipe.stockedIngredientIds?.length ?? 0;
  if (stocked > 0) {
    score += Math.min(stocked, 5) * 5;
  }

  const expiring = new Set(day.expiringIngredientIds ?? []);
  const expiringUsed = ingredientIds.filter((id) => expiring.has(id)).length;
  if (expiringUsed > 0) {
    score += Math.min(expiringUsed, 5) * 8;
  }

  return score;
}

/**
 * Plans the three main meals (and explicitly enabled snacks), honouring meal modes and pinned
 * wishes. Reservations count before automatic picks, which prefer other suitable
 * recipes and only repeat when the available choices require it.
 */
export function planWeek(input: PlanWeekInput): PlanProposal {
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
  const usedIngredientIds = new Set<number>();
  const recipeUseCounts = new Map<number, number>();
  const chosenIngredientSets: ReadonlySet<number>[] = [];
  const pinnedByKey = new Map(pinned.map((wish) => [`${wish.day}|${wish.mealType}`, wish]));
  const recencyPenalties = input.weekStartDate
    ? recipeRecencyPenalties(input.recentUses ?? [], input.weekStartDate) : new Map<number, number>();
  const registerRecipe = (recipeId: number) => {
    usedRecipeIds.add(recipeId);
    recipeUseCounts.set(recipeId, (recipeUseCounts.get(recipeId) ?? 0) + 1);
    for (const ingredientId of recipeById.get(recipeId)?.ingredientIds ?? []) usedIngredientIds.add(ingredientId);
    const ingredients = recipeById.get(recipeId)?.ingredientIds ?? [];
    if (ingredients.length >= 3) chosenIngredientSets.push(new Set(ingredients));
  };
  for (const recipeId of input.existingRecipeIds ?? []) registerRecipe(recipeId);
  for (const wish of pinnedByKey.values()) {
    if (wish.recipeId === null || wish.kind === 'leftovers') continue;
    const recipe = recipeById.get(wish.recipeId);
    const day = input.days.find((entry) => entry.day === wish.day);
    const setting = day ? mealSetting(day, wish.mealType, input.mealType === 'snack') : null;
    if (recipe && (setting ? allowsRecipeForMeal(recipe, setting) : recipeMealTypes(recipe).includes(wish.mealType))) {
      registerRecipe(recipe.id);
    }
  }

  const slots: ProposedSlot[] = [];
  const warnings: string[] = [];

  const requestedMeals = input.days.flatMap((day) => {
    const mealTypes = input.mealType ? [input.mealType] : [
      ...MAIN_MEAL_TYPES,
      ...(day.mealSettings?.some((setting) => setting.mealType === 'snack' && setting.enabled) ? ['snack' as const] : []),
    ];
    return mealTypes.map((mealType) => ({ day, mealType }));
  });
  const order = new Map(requestedMeals.map(({ day, mealType }, index) => [`${day.day}|${mealType}`, index]));
  // Reserve scarce choices before flexible days can consume the only quick or meal-specific recipe.
  const scheduled = requestedMeals.map((request, index) => {
    const setting = mealSetting(request.day, request.mealType, input.mealType === 'snack');
    const wish = pinnedByKey.get(`${request.day.day}|${request.mealType}`);
    const scarcity = wish ? -1 : cookCandidates(
      { ...request.day, mode: setting.mode, cookMinutes: setting.cookMinutes }, request.mealType, input.recipes,
    ).length;
    return { ...request, setting, scarcity, index };
  }).sort((a, b) => a.scarcity - b.scarcity || a.index - b.index);
  for (const { day, mealType, setting } of scheduled) {
    if (!setting.enabled) continue;
    const mealDay = { ...day, mode: setting.mode, cookMinutes: setting.cookMinutes };
    const wish = pinnedByKey.get(`${day.day}|${mealType}`);
    const wishedRecipe = wish?.recipeId != null ? recipeById.get(wish.recipeId) : null;
    if (wish?.kind === 'leftovers') {
      slots.push({
        day: day.day, mealType, kind: 'leftovers', recipeId: wishedRecipe?.id ?? null, freeText: null,
        servings: day.servings ?? input.defaultServings, reason: 'Leftovers reserved by you', score: Number.POSITIVE_INFINITY,
      });
      continue;
    }
    if (wish && (wish.recipeId === null || (wishedRecipe && allowsRecipeForMeal(wishedRecipe, setting)))) {
      if (wish.recipeId !== null) {
        slots.push({
          day: day.day,
          mealType,
          kind: 'recipe',
          recipeId: wish.recipeId,
          freeText: null,
          servings: day.servings ?? input.defaultServings,
          reason: 'Pinned by you',
          score: Number.POSITIVE_INFINITY,
        });
      } else if (wish.freeText && wish.freeText.trim() !== '') {
        slots.push({
          day: day.day,
          mealType,
          kind: 'free_text',
          recipeId: null,
          freeText: wish.freeText.trim(),
          servings: day.servings ?? input.defaultServings,
          reason: 'Pinned by you',
          score: Number.POSITIVE_INFINITY,
        });
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
      }
      continue;
    }

    if (mealDay.mode === 'no_cook') {
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
      continue;
    }

    if (mealDay.mode === 'leftovers') {
      slots.push({
        day: day.day,
        mealType,
        kind: 'leftovers',
        recipeId: null,
        freeText: null,
        servings: day.servings ?? input.defaultServings,
        reason: 'Leftovers night',
        score: 0,
      });
      continue;
    }

    const slot = decideCook(mealDay, mealType, input.recipes, {
      ratings,
      usedRecipeIds,
      usedIngredientIds,
      defaultServings: input.defaultServings,
      recipeUseCounts,
      recencyPenalties,
      rotationKey: input.weekStartDate,
      chosenIngredientSets,
    }, warnings);
    if (slot.recipeId !== null) {
      registerRecipe(slot.recipeId);
    }
    slots.push(slot);
  }

  slots.sort((a, b) => (order.get(`${a.day}|${a.mealType}`) ?? 0) - (order.get(`${b.day}|${b.mealType}`) ?? 0));
  return { slots, warnings };
}

function mealSetting(day: PlannerDay, mealType: MealType, explicitSnack = false): MealSetting {
  return day.mealSettings?.find((entry) => entry.mealType === mealType) ?? {
    mealType, mode: day.mode, cookMinutes: day.cookMinutes, enabled: mealType !== 'snack' || explicitSnack,
  };
}

function cookCandidates(day: PlannerDay, mealType: MealType, recipes: readonly PlannerRecipe[]): PlannerRecipe[] {
  return recipes.filter((recipe) =>
    recipeMealTypes(recipe).includes(mealType) && isEatingOut(recipe) === (day.mode === 'eating_out') &&
    (day.mode === 'eating_out' || recipe.prepMinutes + recipe.cookMinutes <= day.cookMinutes));
}

function decideCook(
  day: PlannerDay,
  mealType: MealType,
  recipes: readonly PlannerRecipe[],
  context: ScoreContext,
  warnings: string[]
): ProposedSlot {
  const candidates = cookCandidates(day, mealType, recipes);
  if (candidates.length === 0) {
    warnings.push(`No suitable ${day.mode === 'eating_out' ? 'eating-out ' : ''}${mealType} recipe fits ${day.day}.`);
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

  // Pantry and deal bonuses must not beat a suitable unused recipe merely by overwhelming a fixed repeat penalty.
  const ranked = candidates
    .map((recipe) => ({
      recipe, score: scoreRecipe(recipe, day, context),
      uses: context.recipeUseCounts?.get(recipe.id) ?? (context.usedRecipeIds.has(recipe.id) ? 1 : 0),
    }))
    .sort((a, b) => a.uses - b.uses || b.score - a.score ||
      (context.rotationKey ? recipeRotationRank(context.rotationKey, a.recipe.id) - recipeRotationRank(context.rotationKey, b.recipe.id) : 0) ||
      a.recipe.id - b.recipe.id);

  const best = ranked[0];
  const total = best.recipe.prepMinutes + best.recipe.cookMinutes;
  const repeatWarning = 'Some meals repeat because there are not enough different recipes that fit their meal types and cooking times.';
  if (best.uses > 0 && !warnings.includes(repeatWarning)) warnings.push(repeatWarning);

  return {
    day: day.day,
    mealType,
    kind: 'recipe',
    recipeId: best.recipe.id,
    freeText: null,
    servings: day.servings ?? context.defaultServings,
    reason: day.mode === 'eating_out' ? 'Eating out, as requested'
      : `${best.uses > 0 ? 'Repeat: limited suitable alternatives. ' : ''}Fits your ${day.cookMinutes} min (about ${total} min)`,
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
    usedIngredientIds?: readonly number[];
    weekStartDate?: string;
    recentUses?: readonly RecipeUse[];
  }
): ProposedSlot {
  if (day.mode === 'no_cook' || day.mode === 'leftovers') {
    return planWeek({ days: [day], recipes, defaultServings: options.defaultServings, mealType: options.mealType ?? 'dinner' }).slots[0];
  }
  const ratings = new Map<number, number>();
  for (const [recipeId, stats] of computeRatings(options.history ?? [])) {
    if (stats.averageRating !== null) {
      ratings.set(recipeId, stats.averageRating);
    }
  }
  const usedRecipeIds = new Set(options.excludeRecipeIds ?? []);
  const usedIngredientIds = new Set(options.usedIngredientIds ?? []);
  const warnings: string[] = [];
  return decideCook(
    day,
    options.mealType ?? 'dinner',
    recipes,
    {
      ratings,
      usedRecipeIds,
      usedIngredientIds,
      defaultServings: options.defaultServings,
      rotationKey: options.weekStartDate,
      recencyPenalties: options.weekStartDate ? recipeRecencyPenalties(options.recentUses ?? [], options.weekStartDate) : undefined,
    },
    warnings
  );
}
