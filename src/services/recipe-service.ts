import { EATING_OUT_TAG, MEAL_TYPES, type MealType } from '../models';

export function recipeMealTypes(recipe: { category: MealType; tags: readonly string[] }): MealType[] {
  const tags = recipe.tags.map((tag) => tag.trim().toLowerCase());
  const tagged = MEAL_TYPES.filter((mealType) => tags.includes(mealType));
  return tagged.length ? tagged : [recipe.category];
}

export function isEatingOut(recipe: { tags: readonly string[] }): boolean {
  return recipe.tags.some((tag) => tag.trim().toLowerCase().replace(/[ -]/g, '_') === EATING_OUT_TAG);
}

export interface RecipeSummary {
  id: number;
  name: string;
  description: string | null;
  category: MealType;
  prepMinutes: number;
  cookMinutes: number;
  isFavorite: boolean;
  tags: string[];
}

export interface RatingEntry {
  recipeId: number;
  rating: number | null;
}

export interface RecipeStats {
  averageRating: number | null;
  ratingCount: number;
}

export function totalMinutes(recipe: Pick<RecipeSummary, 'prepMinutes' | 'cookMinutes'>): number {
  return recipe.prepMinutes + recipe.cookMinutes;
}

export function averageRating(ratings: readonly number[]): number | null {
  if (ratings.length === 0) {
    return null;
  }
  const sum = ratings.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function computeRatings(entries: readonly RatingEntry[]): Map<number, RecipeStats> {
  const collected = new Map<number, number[]>();
  for (const entry of entries) {
    if (entry.rating === null) {
      continue;
    }
    const list = collected.get(entry.recipeId);
    if (list) {
      list.push(entry.rating);
    } else {
      collected.set(entry.recipeId, [entry.rating]);
    }
  }
  const stats = new Map<number, RecipeStats>();
  for (const [recipeId, ratings] of collected) {
    stats.set(recipeId, { averageRating: averageRating(ratings), ratingCount: ratings.length });
  }
  return stats;
}

export interface RecipeFilter {
  query?: string;
  category?: MealType | null;
  maxMinutes?: number | null;
  favoriteOnly?: boolean;
  tags?: readonly string[];
}

export function matchesQuery(recipe: RecipeSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return (
    recipe.name.toLowerCase().includes(needle) ||
    (recipe.description?.toLowerCase().includes(needle) ?? false) ||
    recipe.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

export function filterRecipes<T extends RecipeSummary>(
  recipes: readonly T[],
  filter: RecipeFilter
): T[] {
  const wantedTags = (filter.tags ?? []).map((tag) => tag.toLowerCase());
  return recipes.filter((recipe) => {
    if (filter.query !== undefined && !matchesQuery(recipe, filter.query)) {
      return false;
    }
    if (filter.category != null && !recipeMealTypes(recipe).includes(filter.category)) {
      return false;
    }
    if (filter.maxMinutes != null && totalMinutes(recipe) > filter.maxMinutes) {
      return false;
    }
    if (filter.favoriteOnly && !recipe.isFavorite) {
      return false;
    }
    if (wantedTags.length > 0) {
      const tags = recipe.tags.map((tag) => tag.toLowerCase());
      if (!wantedTags.every((tag) => tags.includes(tag))) {
        return false;
      }
    }
    return true;
  });
}
