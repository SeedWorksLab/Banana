import type {
  Ingredient,
  IngredientCategory,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  RecipeTag,
  Slot,
  WeekDayBudget,
} from '../models';
import type { RecipeSummary } from '../services/recipe-service';
import { isEatingOut } from '../services/recipe-service';
import type { PlannerRecipe } from '../services/planning-service';
import type { PlannedMeal } from '../services/shopping-list-service';

export function buildRecipeSummaries(
  recipes: readonly Recipe[],
  tags: readonly RecipeTag[]
): RecipeSummary[] {
  const tagsByRecipe = new Map<number, string[]>();
  for (const tag of tags) {
    const list = tagsByRecipe.get(tag.recipeId);
    if (list) {
      list.push(tag.tag);
    } else {
      tagsByRecipe.set(tag.recipeId, [tag.tag]);
    }
  }
  return recipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    category: recipe.category,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    isFavorite: recipe.isFavorite,
    tags: tagsByRecipe.get(recipe.id) ?? [],
  }));
}

export function buildIngredientNamesByRecipe(
  recipeIngredients: readonly RecipeIngredient[],
  ingredients: readonly Ingredient[]
): Map<number, string[]> {
  const nameById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient.name]));
  const namesByRecipe = new Map<number, string[]>();
  for (const row of recipeIngredients) {
    const name = nameById.get(row.ingredientId);
    if (name === undefined) {
      continue;
    }
    const list = namesByRecipe.get(row.recipeId);
    if (list) {
      list.push(name);
    } else {
      namesByRecipe.set(row.recipeId, [name]);
    }
  }
  return namesByRecipe;
}

const BATCH_TAGS = new Set(['batch', 'freezer', 'leftovers']);

export interface IngredientFacts {
  ids: number[];
  categories: IngredientCategory[];
}

export function buildIngredientFactsByRecipe(
  recipeIngredients: readonly RecipeIngredient[],
  ingredients: readonly Ingredient[]
): Map<number, IngredientFacts> {
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const factsByRecipe = new Map<number, IngredientFacts>();
  for (const row of recipeIngredients) {
    const ingredient = ingredientById.get(row.ingredientId);
    if (!ingredient) {
      continue;
    }
    let facts = factsByRecipe.get(row.recipeId);
    if (!facts) {
      facts = { ids: [], categories: [] };
      factsByRecipe.set(row.recipeId, facts);
    }
    if (!facts.ids.includes(row.ingredientId)) {
      facts.ids.push(row.ingredientId);
      facts.categories.push(ingredient.category);
    }
  }
  return factsByRecipe;
}

export function buildPlannerRecipes(
  summaries: readonly RecipeSummary[],
  ingredientNamesByRecipe: ReadonlyMap<number, string[]>,
  defaultServings: number,
  options: {
    factsByRecipe?: ReadonlyMap<number, IngredientFacts>;
    stockedIngredientIds?: ReadonlySet<number>;
    onOfferIngredientIds?: ReadonlySet<number>;
  } = {}
): PlannerRecipe[] {
  return summaries.map((summary) => {
    const facts = options.factsByRecipe?.get(summary.id);
    const ingredientIds = facts?.ids ?? [];
    return {
      id: summary.id,
      name: summary.name,
      category: summary.category,
      prepMinutes: summary.prepMinutes,
      cookMinutes: summary.cookMinutes,
      ingredientNames: ingredientNamesByRecipe.get(summary.id) ?? [],
      tags: summary.tags,
      servings: defaultServings,
      isFavorite: summary.isFavorite,
      batchFriendly: summary.tags.some((tag) => BATCH_TAGS.has(tag.toLowerCase())),
      ingredientIds,
      ingredientCategories: facts?.categories,
      stockedIngredientIds: ingredientIds.filter((id) =>
        options.stockedIngredientIds?.has(id)
      ),
      onOfferIngredientIds: ingredientIds.filter((id) =>
        options.onOfferIngredientIds?.has(id)
      ),
    };
  });
}

export function buildPlannedMeals(
  slots: readonly Pick<Slot, 'id' | 'kind' | 'recipeId' | 'day' | 'servings'>[],
  recipes: readonly Pick<Recipe, 'id' | 'servings'>[],
  recipeIngredients: readonly Pick<RecipeIngredient, 'recipeId' | 'ingredientId' | 'quantity' | 'unit' | 'optional'>[],
  ingredients: readonly Pick<Ingredient, 'id' | 'name' | 'category'>[],
  budgets: readonly Pick<WeekDayBudget, 'day' | 'homeId'>[] = [],
  defaultHomeId: number | null = null,
  tags: readonly Pick<RecipeTag, 'recipeId' | 'tag'>[] = []
): PlannedMeal[] {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const homeByDay = new Map(budgets.map((budget) => [budget.day, budget.homeId]));
  const meals: PlannedMeal[] = [];
  for (const slot of slots) {
    if (slot.kind !== 'recipe' || slot.recipeId === null ||
      isEatingOut({ tags: tags.filter((tag) => tag.recipeId === slot.recipeId).map((tag) => tag.tag) })) {
      continue;
    }
    const recipe = recipeById.get(slot.recipeId);
    meals.push({
      slotId: slot.id,
      homeId: homeByDay.get(slot.day) ?? defaultHomeId,
      servings: slot.servings,
      recipeServings: recipe?.servings ?? slot.servings,
      ingredients: recipeIngredients
        .filter((row) => row.recipeId === slot.recipeId && !row.optional)
        .map((row) => {
          const ingredient = ingredientById.get(row.ingredientId);
          return {
            ingredientId: row.ingredientId,
            name: ingredient?.name ?? 'Ingredient',
            category: ingredient?.category ?? 'other',
            quantity: row.quantity,
            unit: row.unit,
          };
        }),
    });
  }
  return meals;
}

export function recipeStepsFor(
  steps: readonly RecipeStep[],
  recipeId: number
): RecipeStep[] {
  return steps
    .filter((step) => step.recipeId === recipeId)
    .sort((a, b) => a.stepIndex - b.stepIndex);
}

export function recipeIngredientsFor(
  recipeIngredients: readonly RecipeIngredient[],
  recipeId: number
): RecipeIngredient[] {
  return recipeIngredients
    .filter((row) => row.recipeId === recipeId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
