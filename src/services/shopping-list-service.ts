import type { IngredientCategory, Unit } from '../models';
import type { IngredientDeal } from './deal-service';
import { shortage, type PantryLookupItem } from './pantry-service';

export interface PlannedIngredient {
  ingredientId: number;
  name: string;
  category: IngredientCategory;
  quantity: number;
  unit: Unit;
}

export interface PlannedMeal {
  slotId: number;
  homeId: number | null;
  servings: number;
  recipeServings: number;
  ingredients: PlannedIngredient[];
}

export interface ShoppingLine {
  ingredientId: number | null;
  homeId: number | null;
  label: string;
  category: IngredientCategory;
  quantity: number;
  unit: Unit;
  dealId: number | null;
  storeId: number | null;
  priceCents: number | null;
  savingsCents: number;
}

export interface ShoppingCategoryGroup {
  category: IngredientCategory;
  lines: ShoppingLine[];
}

export interface ShoppingList {
  lines: ShoppingLine[];
  groups: ShoppingCategoryGroup[];
  estimatedTotalCents: number;
  estimatedSavingsCents: number;
  pricedLines: number;
  unpricedLines: number;
}

export interface ShoppingListInput {
  meals: readonly PlannedMeal[];
  pantryItems?: readonly PantryLookupItem[];
  bestDeals?: ReadonlyMap<number, IngredientDeal>;
}

/**
 * The order a shopper naturally walks a supermarket, so the list follows the
 * aisles instead of the alphabet (idea.txt §6.2). Household goods are last
 * because they are the furthest from the fresh departments.
 */
export const AISLE_ROUTE: readonly IngredientCategory[] = [
  'produce',
  'bakery',
  'meat_fish',
  'dairy',
  'frozen',
  'pantry',
  'drinks',
  'household',
  'other',
];

const AISLE_INDEX = new Map<IngredientCategory, number>(
  AISLE_ROUTE.map((category, index) => [category, index])
);

export function aisleOrder(category: IngredientCategory): number {
  return AISLE_INDEX.get(category) ?? AISLE_ROUTE.length;
}

type Dimension = 'mass' | 'volume' | 'count';

interface Accumulator {
  ingredientId: number;
  homeId: number | null;
  label: string;
  category: IngredientCategory;
  dimension: Dimension;
  countUnit: Unit | null;
  baseQuantity: number;
}

export function dimensionOf(unit: Unit): Dimension {
  if (unit === 'g' || unit === 'kg') return 'mass';
  if (unit === 'ml' || unit === 'l') return 'volume';
  return 'count';
}

function toBase(quantity: number, unit: Unit): number {
  if (unit === 'kg' || unit === 'l') return quantity * 1000;
  return quantity;
}

function displayUnit(accumulator: Accumulator): { quantity: number; unit: Unit } {
  if (accumulator.dimension === 'mass') {
    return accumulator.baseQuantity >= 1000
      ? { quantity: accumulator.baseQuantity / 1000, unit: 'kg' }
      : { quantity: accumulator.baseQuantity, unit: 'g' };
  }
  if (accumulator.dimension === 'volume') {
    return accumulator.baseQuantity >= 1000
      ? { quantity: accumulator.baseQuantity / 1000, unit: 'l' }
      : { quantity: accumulator.baseQuantity, unit: 'ml' };
  }
  return { quantity: accumulator.baseQuantity, unit: accumulator.countUnit ?? 'piece' };
}

/**
 * Scales each meal's ingredients to the servings the slot plans for, sums them
 * by ingredient and unit family, and folds mass and volume into one readable
 * unit. Different count units (piece, tbsp, clove) are never merged.
 */
export function aggregateIngredients(meals: readonly PlannedMeal[]): Accumulator[] {
  const accumulators = new Map<string, Accumulator>();
  for (const meal of meals) {
    const scale = meal.recipeServings > 0 ? meal.servings / meal.recipeServings : 1;
    for (const ingredient of meal.ingredients) {
      const dimension = dimensionOf(ingredient.unit);
      const key =
        dimension === 'count'
          ? `${meal.homeId ?? 'default'}|${ingredient.ingredientId}|u:${ingredient.unit}`
          : `${meal.homeId ?? 'default'}|${ingredient.ingredientId}|${dimension}`;
      const existing = accumulators.get(key);
      if (existing) {
        existing.baseQuantity += toBase(ingredient.quantity * scale, ingredient.unit);
      } else {
        accumulators.set(key, {
          ingredientId: ingredient.ingredientId,
          homeId: meal.homeId,
          label: ingredient.name,
          category: ingredient.category,
          dimension,
          countUnit: dimension === 'count' ? ingredient.unit : null,
          baseQuantity: toBase(ingredient.quantity * scale, ingredient.unit),
        });
      }
    }
  }
  return [...accumulators.values()];
}

export function buildShoppingList(input: ShoppingListInput): ShoppingList {
  const pantryItems = input.pantryItems ?? [];
  const bestDeals = input.bestDeals ?? new Map<number, IngredientDeal>();
  const accums = aggregateIngredients(input.meals);

  const lines: ShoppingLine[] = [];
  for (const accumulator of accums) {
    const display = displayUnit(accumulator);
    const pantryItem =
      pantryItems.find(
        (p) =>
          p.ingredientId === accumulator.ingredientId &&
          (accumulator.homeId === null || p.homeId === undefined || p.homeId === accumulator.homeId)
      ) ?? null;
    const remaining = shortage(display, pantryItem);
    if (remaining === null) {
      continue;
    }
    const best = bestDeals.get(accumulator.ingredientId);
    lines.push({
      ingredientId: accumulator.ingredientId,
      homeId: accumulator.homeId,
      label: accumulator.label,
      category: accumulator.category,
      quantity: Math.round(remaining.quantity * 1000) / 1000,
      unit: remaining.unit,
      dealId: best ? best.deal.id : null,
      storeId: best ? best.deal.storeId : null,
      priceCents: best ? best.deal.priceCents : null,
      savingsCents: best ? best.savingsCents : 0,
    });
  }

  return finalizeShoppingList(lines);
}

export function finalizeShoppingList(lines: readonly ShoppingLine[]): ShoppingList {
  const sorted = [...lines].sort((a, b) => {
    const byHome = (a.homeId ?? -1) - (b.homeId ?? -1);
    if (byHome !== 0) {
      return byHome;
    }
    const byAisle = aisleOrder(a.category) - aisleOrder(b.category);
    return byAisle !== 0 ? byAisle : a.label.localeCompare(b.label);
  });

  const groups = new Map<IngredientCategory, ShoppingLine[]>();
  for (const line of sorted) {
    const group = groups.get(line.category);
    if (group) {
      group.push(line);
    } else {
      groups.set(line.category, [line]);
    }
  }

  const pricedLines = lines.filter((line) => line.priceCents !== null).length;

  return {
    lines: sorted,
    groups: [...groups.entries()].map(([category, categoryLines]) => ({
      category,
      lines: categoryLines,
    })),
    estimatedTotalCents: lines.reduce((sum, line) => sum + (line.priceCents ?? 0), 0),
    estimatedSavingsCents: lines.reduce((sum, line) => sum + line.savingsCents, 0),
    pricedLines,
    unpricedLines: lines.length - pricedLines,
  };
}

export function addManualItem(list: ShoppingList, item: ShoppingLine): ShoppingList {
  return finalizeShoppingList([...list.lines, item]);
}
