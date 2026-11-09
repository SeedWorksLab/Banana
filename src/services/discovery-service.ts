export interface DiscoveryRecipe {
  id: number;
  name: string;
  category: string;
  ingredientIds?: readonly number[];
  ingredientNames?: readonly string[];
  onOfferIngredientIds?: readonly number[];
  isFavorite: boolean;
  timesCooked: number;
  averageRating: number | null;
}

export interface DiscoveryOptions {
  dislikedNames?: readonly string[];
  skipRecipeIds?: readonly number[];
  limit?: number;
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
 * currently on offer. Pure and deterministic; ties fall back to the name.
 */
export function recommendRecipes(
  recipes: readonly DiscoveryRecipe[],
  options: DiscoveryOptions = {}
): DiscoverySuggestion[] {
  const disliked = new Set((options.dislikedNames ?? []).map(normalize));
  const skip = new Set(options.skipRecipeIds ?? []);
  const limit = options.limit ?? 5;

  const suggestions: DiscoverySuggestion[] = [];
  for (const recipe of recipes) {
    if (skip.has(recipe.id) || isDisliked(recipe, disliked)) {
      continue;
    }
    const newDish = recipe.timesCooked === 0;
    const novelty = newDish ? 30 : Math.max(0, 20 - recipe.timesCooked * 5);
    const offerBonus = Math.min(MAX_OFFER_BONUS, (recipe.onOfferIngredientIds?.length ?? 0) * 4);
    const favouriteBonus = recipe.isFavorite ? 10 : 0;
    const ratingBonus = (recipe.averageRating ?? 0) * 2;
    const score = novelty + offerBonus + favouriteBonus + ratingBonus;

    let reason: string;
    if (newDish) {
      reason = 'New to you';
    } else if (offerBonus > 0) {
      reason = `${recipe.onOfferIngredientIds?.length ?? 0} ingredients on offer`;
    } else if (recipe.isFavorite) {
      reason = 'A favourite to keep in rotation';
    } else if ((recipe.averageRating ?? 0) >= 4) {
      reason = `You rated it ${recipe.averageRating}`;
    } else {
      reason = 'Ready for another turn';
    }

    suggestions.push({ recipeId: recipe.id, name: recipe.name, score, reason });
  }

  suggestions.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.name.localeCompare(b.name);
  });

  return suggestions.slice(0, limit);
}
