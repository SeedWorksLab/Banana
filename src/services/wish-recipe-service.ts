import type { IngredientCategory, Unit } from '../models';
import type { PantryLookupItem } from './pantry-service';
import { shortage } from './pantry-service';

export interface WishRecipeIngredient {
  ingredientId: number;
  name: string;
  category: IngredientCategory;
  quantity: number;
  unit: Unit;
  optional: boolean;
}

export interface WishRecipeLine {
  ingredientId: number;
  label: string;
  category: IngredientCategory;
  quantity: number;
  unit: Unit;
}

/**
 * The shopping lines a wish recipe needs after subtracting what is already at
 * the home where it will be baked. Optional ingredients are left off unless the
 * user explicitly adds them to the recipe; wish recipes are a deliberate treat,
 * not a full weekly shop.
 */
export function wishRecipeShoppingLines(
  ingredients: readonly WishRecipeIngredient[],
  pantryItems: readonly PantryLookupItem[]
): WishRecipeLine[] {
  const lines: WishRecipeLine[] = [];
  for (const ingredient of ingredients) {
    if (ingredient.optional) {
      continue;
    }
    const pantryItem = pantryItems.find((item) => item.ingredientId === ingredient.ingredientId) ?? null;
    const remaining = shortage({ quantity: ingredient.quantity, unit: ingredient.unit }, pantryItem);
    if (remaining === null) {
      continue;
    }
    lines.push({
      ingredientId: ingredient.ingredientId,
      label: ingredient.name,
      category: ingredient.category,
      quantity: remaining.quantity,
      unit: remaining.unit,
    });
  }
  return lines;
}
