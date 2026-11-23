import { recipeRecencyPenalties, recipeRotationRank } from '../../src/services/recipe-rotation-service';
import type { RecipeUse } from '../../src/models/recipe-use';

it('uses calendar meal dates, decays over 28 days and ignores future or older uses', () => {
  const uses: RecipeUse[] = [
    { recipeId: 1, weekStartDate: '2026-11-16', day: 'mon' },
    { recipeId: 2, weekStartDate: '2026-11-16', day: 'sun' },
    { recipeId: 3, weekStartDate: '2026-10-26', day: 'mon' },
    { recipeId: 4, weekStartDate: '2026-10-19', day: 'mon' },
    { recipeId: 5, weekStartDate: '2026-11-23', day: 'mon' },
    { recipeId: 6, weekStartDate: '2026-11-30', day: 'mon' },
  ];
  expect(recipeRecencyPenalties(uses, '2026-11-23')).toEqual(new Map([[1, 22], [2, 28], [3, 1]]));
  expect(recipeRecencyPenalties([...uses].reverse(), '2026-11-23')).toEqual(recipeRecencyPenalties(uses, '2026-11-23'));
});

it('caps repeated recent use without storing derived scores', () => {
  const uses: RecipeUse[] = Array.from({ length: 5 }, () => ({
    recipeId: 1, weekStartDate: '2026-11-16', day: 'sun',
  }));
  expect(recipeRecencyPenalties(uses, '2026-11-23').get(1)).toBe(60);
  expect(recipeRecencyPenalties([], '2026-11-23').size).toBe(0);
});

it('produces stable, week-specific tie ranks without randomness', () => {
  expect(recipeRotationRank('2026-11-16', 1)).toBe(414625412);
  expect(recipeRotationRank('2026-11-23', 1)).toBe(112613147);
  expect(recipeRotationRank('2026-11-16', 1)).toBe(recipeRotationRank('2026-11-16', 1));
});
