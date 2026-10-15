import type { Diet, MealType } from '../models';

export interface PreferenceRecipe {
  id: number;
  name: string;
  category: MealType;
  prepMinutes: number;
  cookMinutes: number;
  ingredientNames: string[];
  tags: string[];
}

export interface PreferenceContext {
  diet: Diet;
  allergies: string[];
  dislikes: string[];
}

const FORBIDDEN_TAGS: Record<Diet, readonly string[]> = {
  omnivore: [],
  pescatarian: ['meat'],
  vegetarian: ['meat', 'fish'],
  vegan: ['meat', 'fish', 'dairy', 'egg', 'honey'],
};

export function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

function matchesAny(text: string, terms: readonly string[]): boolean {
  const haystack = normalizeTerm(text);
  return terms.some((term) => {
    const needle = normalizeTerm(term);
    return needle !== '' && haystack.includes(needle);
  });
}

export function containsAllergen(
  recipe: PreferenceRecipe,
  allergies: readonly string[]
): boolean {
  return recipe.ingredientNames.some((name) => matchesAny(name, allergies));
}

export function isDisliked(recipe: PreferenceRecipe, dislikes: readonly string[]): boolean {
  return matchesAny(recipe.name, dislikes) || recipe.ingredientNames.some((name) => matchesAny(name, dislikes));
}

export function satisfiesDiet(recipe: PreferenceRecipe, diet: Diet): boolean {
  const forbidden = FORBIDDEN_TAGS[diet];
  if (forbidden.length === 0) {
    return true;
  }
  const tags = recipe.tags.map(normalizeTerm);
  return forbidden.every((tag) => !tags.includes(tag));
}

/**
 * Allergies are absolute and are enforced here, never left to the AI or the
 * prompt (AGENTS.md §8). Diet and dislikes are preferences: a disliked recipe is
 * excluded from automatic planning but may still be chosen by hand elsewhere.
 */
export function isRecipeAllowed(
  recipe: PreferenceRecipe,
  context: PreferenceContext
): boolean {
  if (containsAllergen(recipe, context.allergies)) {
    return false;
  }
  if (isDisliked(recipe, context.dislikes)) {
    return false;
  }
  return satisfiesDiet(recipe, context.diet);
}

export function filterRecipesForPreferences<T extends PreferenceRecipe>(
  recipes: readonly T[],
  context: PreferenceContext
): T[] {
  return recipes.filter((recipe) => isRecipeAllowed(recipe, context));
}

export function isWithinBudget(estimatedCents: number, weeklyBudgetCents: number): boolean {
  return estimatedCents <= weeklyBudgetCents;
}

export type BudgetStatus = 'saving' | 'pricey';

export function budgetStatus(
  estimatedCents: number,
  weeklyBudgetCents: number
): BudgetStatus {
  return isWithinBudget(estimatedCents, weeklyBudgetCents) ? 'saving' : 'pricey';
}

export function budgetRemainingCents(
  estimatedCents: number,
  weeklyBudgetCents: number
): number {
  return weeklyBudgetCents - estimatedCents;
}
