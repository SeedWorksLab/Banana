import { computeRatings, type RatingEntry } from './recipe-service';
import { recipeRecencyPenalties, recipeRotationRank } from './recipe-rotation-service';
import type { RecipeUse } from '../models/recipe-use';

export interface DiscoveryRecipe {
  id: number;
  name: string;
  category: string;
  ingredientIds?: readonly number[];
  ingredientNames?: readonly string[];
  onOfferIngredientIds?: readonly number[];
  isFavorite: boolean;
  timesCooked?: number;
  averageRating?: number | null;
}

export interface DiscoveryOptions {
  dislikedNames?: readonly string[];
  skipRecipeIds?: readonly number[];
  limit?: number;
  history?: readonly RatingEntry[];
  recentUses?: readonly RecipeUse[];
  referenceDate?: string;
  rotationKey?: string;
}

export interface DiscoverySuggestion {
  recipeId: number;
  name: string;
  score: number;
  reason: string;
}

const MAX_OFFER_BONUS = 12;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isDisliked(recipe: DiscoveryRecipe, disliked: ReadonlySet<string>): boolean {
  return (recipe.ingredientNames ?? []).some((name) => disliked.has(normalize(name)));
}

/**
 * Ranks recipes the household might want next: never-cooked dishes first, then
 * favourites that should come back around, both lifted by ingredients that are
 * currently on offer. Recent plans cool down repeated suggestions; the shortlist
 * balances meal types and ingredient overlap. Weekly rotation breaks ties.
 */
export function recommendRecipes(
  recipes: readonly DiscoveryRecipe[],
  options: DiscoveryOptions = {}
): DiscoverySuggestion[] {
  const disliked = new Set((options.dislikedNames ?? []).map(normalize));
  const skip = new Set(options.skipRecipeIds ?? []);
  const limit = options.limit ?? 5;
  const ratings = options.history ? computeRatings(options.history) : null;
  const cookCounts = new Map<number, number>();
  for (const entry of options.history ?? []) {
    if (entry.kind !== 'leftovers') cookCounts.set(entry.recipeId, (cookCounts.get(entry.recipeId) ?? 0) + 1);
  }
  const recency = options.referenceDate
    ? recipeRecencyPenalties(options.recentUses ?? [], options.referenceDate) : new Map<number, number>();

  const suggestions: DiscoverySuggestion[] = [];
  for (const recipe of recipes) {
    if (skip.has(recipe.id) || isDisliked(recipe, disliked)) {
      continue;
    }
    const timesCooked = options.history ? cookCounts.get(recipe.id) ?? 0 : recipe.timesCooked ?? 0;
    const rating = ratings ? ratings.get(recipe.id)?.averageRating ?? null : recipe.averageRating ?? null;
    const newDish = timesCooked === 0;
    const novelty = newDish ? 30 : Math.max(0, 20 - timesCooked * 5);
    const offerBonus = Math.min(MAX_OFFER_BONUS, (recipe.onOfferIngredientIds?.length ?? 0) * 4);
    const favouriteBonus = recipe.isFavorite ? 10 : 0;
    const ratingBonus = (rating ?? 0) * 2;
    const score = novelty + offerBonus + favouriteBonus + ratingBonus - (recency.get(recipe.id) ?? 0);

    let reason: string;
    if (newDish) {
      reason = 'New to you';
    } else if (offerBonus > 0) {
      reason = `${recipe.onOfferIngredientIds?.length ?? 0} ingredients on offer`;
    } else if (recipe.isFavorite) {
      reason = 'A favourite to keep in rotation';
    } else if ((rating ?? 0) >= 4) {
      reason = `You rated it ${rating}`;
    } else {
      reason = 'Ready for another turn';
    }

    suggestions.push({ recipeId: recipe.id, name: recipe.name, score, reason });
  }

  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const selected: DiscoverySuggestion[] = [];
  while (suggestions.length && selected.length < limit) {
    const ranked = suggestions.map((suggestion) => ({
      ...suggestion,
      score: suggestion.score - shortlistSimilarity(byId.get(suggestion.recipeId)!, selected.map((entry) => byId.get(entry.recipeId)!)),
    })).sort((a, b) => b.score - a.score ||
      (options.rotationKey ? recipeRotationRank(options.rotationKey, a.recipeId) - recipeRotationRank(options.rotationKey, b.recipeId) : 0) ||
      a.name.localeCompare(b.name) || a.recipeId - b.recipeId);
    selected.push(ranked[0]);
    suggestions.splice(suggestions.findIndex((entry) => entry.recipeId === ranked[0].recipeId), 1);
  }
  return selected;
}

function shortlistSimilarity(recipe: DiscoveryRecipe, selected: readonly DiscoveryRecipe[]): number {
  const ids = new Set(recipe.ingredientIds ?? []);
  let penalty = 0;
  for (const previous of selected) {
    if (recipe.category === previous.category) penalty += 6;
    const previousIds = new Set(previous.ingredientIds ?? []);
    const overlap = [...ids].filter((id) => previousIds.has(id)).length;
    const union = new Set([...ids, ...previousIds]).size;
    if (union) penalty += 8 * overlap / union;
  }
  return penalty;
}
