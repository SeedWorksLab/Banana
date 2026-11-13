import type { IngredientCategory } from '../models';
import { addDays, todayDate } from '../utils/date';

const DEFAULT_SHELF_LIFE_DAYS: Record<IngredientCategory, number> = {
  produce: 7,
  bakery: 4,
  meat_fish: 3,
  dairy: 5,
  pantry: 180,
  frozen: 180,
  drinks: 14,
  household: 365,
  other: 30,
};

const KEYWORD_SHELF_LIFE_DAYS: readonly { match: string; days: number }[] = [
  { match: 'berry', days: 3 },
  { match: 'berries', days: 3 },
  { match: 'spinach', days: 4 },
  { match: 'lettuce', days: 4 },
  { match: 'milk', days: 5 },
  { match: 'yoghurt', days: 7 },
  { match: 'yogurt', days: 7 },
  { match: 'cream', days: 5 },
  { match: 'cheese', days: 14 },
  { match: 'bread', days: 4 },
  { match: 'chicken', days: 3 },
  { match: 'fish', days: 2 },
  { match: 'mince', days: 2 },
  { match: 'avocado', days: 3 },
  { match: 'banana', days: 5 },
  { match: 'apple', days: 14 },
];

export function defaultShelfLifeDays(category: IngredientCategory): number {
  return DEFAULT_SHELF_LIFE_DAYS[category];
}

export function shelfLifeDaysFor(
  name: string,
  category: IngredientCategory,
  override: number | null
): number {
  if (override !== null && override > 0) {
    return override;
  }
  const normalized = name.trim().toLowerCase();
  const keyword = KEYWORD_SHELF_LIFE_DAYS.find((entry) => normalized.includes(entry.match));
  return keyword?.days ?? defaultShelfLifeDays(category);
}

export function estimateExpiryDate(
  boughtOn: string,
  name: string,
  category: IngredientCategory,
  override: number | null
): string {
  return addDays(boughtOn, shelfLifeDaysFor(name, category, override));
}

export interface ExpiryItem {
  ingredientId: number;
  expiresOn: string | null;
}

export interface ExpiringIngredient {
  ingredientId: number;
  expiresOn: string;
  daysLeft: number;
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function expiringIngredients(
  items: readonly ExpiryItem[],
  today: string,
  withinDays = 3
): ExpiringIngredient[] {
  const result: ExpiringIngredient[] = [];
  for (const item of items) {
    if (item.expiresOn === null) {
      continue;
    }
    const daysLeft = daysBetween(today, item.expiresOn);
    if (daysLeft <= withinDays) {
      result.push({ ingredientId: item.ingredientId, expiresOn: item.expiresOn, daysLeft });
    }
  }
  return result.sort((a, b) => a.daysLeft - b.daysLeft || a.ingredientId - b.ingredientId);
}

export function expiringIngredientIds(
  items: readonly ExpiryItem[],
  today: string,
  withinDays = 3
): number[] {
  return expiringIngredients(items, today, withinDays).map((item) => item.ingredientId);
}

export function isExpired(expiresOn: string | null, today: string): boolean {
  return expiresOn !== null && expiresOn < today;
}

export function soonLabel(daysLeft: number): string {
  if (daysLeft < 0) {
    return 'past date';
  }
  if (daysLeft === 0) {
    return 'today';
  }
  if (daysLeft === 1) {
    return 'tomorrow';
  }
  return `${daysLeft} days`;
}

export function freshToday(): string {
  return todayDate();
}
