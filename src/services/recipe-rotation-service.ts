import dayjs from 'dayjs';
import { WEEK_DAYS } from '../models';
import type { RecipeUse } from '../models/recipe-use';
import { addDays } from '../utils/date';

export function recipeRecencyPenalties(uses: readonly RecipeUse[], referenceDate: string): Map<number, number> {
  const penalties = new Map<number, number>();
  for (const use of uses) {
    const date = addDays(use.weekStartDate, WEEK_DAYS.indexOf(use.day));
    const daysAgo = dayjs(referenceDate).diff(date, 'day');
    if (daysAgo < 1 || daysAgo > 28 || !Number.isFinite(daysAgo)) continue;
    const penalty = 29 - daysAgo;
    penalties.set(use.recipeId, Math.min(60, (penalties.get(use.recipeId) ?? 0) + penalty));
  }
  return penalties;
}

export function recipeRotationRank(key: string, recipeId: number): number {
  let hash = 2166136261;
  for (const character of `${key}:${recipeId}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return (hash ^ (hash >>> 16)) >>> 0;
}
