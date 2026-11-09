import type { PantryLevel, Unit } from '../models';
import { convert } from '../utils/units';

export interface PantryLookupItem {
  ingredientId: number;
  level: PantryLevel;
  quantity: number | null;
  unit: Unit | null;
}

export interface RequiredQuantity {
  quantity: number;
  unit: Unit;
}

export function findPantryItem<T extends PantryLookupItem>(
  items: readonly T[],
  ingredientId: number
): T | null {
  return items.find((item) => item.ingredientId === ingredientId) ?? null;
}

/**
 * How much of a required amount still has to be bought once the pantry is
 * counted. `stocked` subtracts what is on hand; `low` and `out` mean the whole
 * amount is needed, because "low" is treated as effectively empty. A `null`
 * result means nothing needs buying.
 */
export function shortage(
  required: RequiredQuantity,
  item: PantryLookupItem | null
): RequiredQuantity | null {
  if (required.quantity <= 0) {
    return null;
  }
  if (item === null || item.level !== 'stocked' || item.quantity === null || item.unit === null) {
    return { ...required };
  }
  const available = convert(item.quantity, item.unit, required.unit);
  if (available === null) {
    return { ...required };
  }
  const remaining = required.quantity - available;
  if (remaining <= 0) {
    return null;
  }
  return { quantity: remaining, unit: required.unit };
}

export interface StockingSuggestion {
  ingredientId: number;
  level: PantryLevel;
}

export function stockingSuggestions(
  items: readonly PantryLookupItem[]
): StockingSuggestion[] {
  return items
    .filter((item) => item.level !== 'stocked')
    .map((item) => ({ ingredientId: item.ingredientId, level: item.level }));
}

export function pantryLevelFor(
  items: readonly PantryLookupItem[],
  ingredientId: number
): PantryLevel | null {
  return findPantryItem(items, ingredientId)?.level ?? null;
}

export interface PantryCoverage {
  stocked: number[];
  low: number[];
  out: number[];
  unknown: number[];
  missing: number[];
}

/**
 * Splits the ingredients a recipe needs into what is already in the house and
 * what still has to be bought. "Low" counts as needing a top-up, mirroring
 * `shortage` so the recipe view and the shopping list never disagree.
 */
export function pantryCoverage(
  ingredientIds: readonly number[],
  items: readonly PantryLookupItem[]
): PantryCoverage {
  const coverage: PantryCoverage = {
    stocked: [],
    low: [],
    out: [],
    unknown: [],
    missing: [],
  };
  for (const ingredientId of new Set(ingredientIds)) {
    const level = pantryLevelFor(items, ingredientId);
    if (level === 'stocked') {
      coverage.stocked.push(ingredientId);
    } else if (level === 'low') {
      coverage.low.push(ingredientId);
      coverage.missing.push(ingredientId);
    } else if (level === 'out') {
      coverage.out.push(ingredientId);
      coverage.missing.push(ingredientId);
    } else {
      coverage.unknown.push(ingredientId);
      coverage.missing.push(ingredientId);
    }
  }
  return coverage;
}

export function canCookFromPantry(
  ingredientIds: readonly number[],
  items: readonly PantryLookupItem[]
): boolean {
  return pantryCoverage(ingredientIds, items).missing.length === 0;
}
