import {
  defaultShelfLifeDays,
  estimateExpiryDate,
  expiringIngredientIds,
  expiringIngredients,
  isExpired,
  shelfLifeDaysFor,
  soonLabel,
} from '../../src/services/expiry-service';

describe('shelf life estimates', () => {
  it('uses category defaults when no name matches', () => {
    expect(defaultShelfLifeDays('produce')).toBe(7);
    expect(defaultShelfLifeDays('dairy')).toBe(5);
    expect(shelfLifeDaysFor('Mystery vegetable', 'produce', null)).toBe(7);
  });

  it('refines a category default with a known keyword', () => {
    expect(shelfLifeDaysFor('Whole milk', 'dairy', null)).toBe(5);
    expect(shelfLifeDaysFor('Strawberries', 'produce', null)).toBe(3);
    expect(shelfLifeDaysFor('Apples', 'produce', null)).toBe(14);
  });

  it('always trusts an explicit shelf life from the ingredient', () => {
    expect(shelfLifeDaysFor('Whole milk', 'dairy', 21)).toBe(21);
    expect(shelfLifeDaysFor('Strawberries', 'produce', 1)).toBe(1);
  });

  it('estimates an expiry date from the day it was bought', () => {
    expect(estimateExpiryDate('2026-11-10', 'Whole milk', 'dairy', null)).toBe('2026-11-15');
    expect(estimateExpiryDate('2026-11-10', 'Rice', 'pantry', 365)).toBe('2027-11-10');
  });
});

describe('expiring ingredients', () => {
  const items = [
    { ingredientId: 1, expiresOn: '2026-11-20' },
    { ingredientId: 2, expiresOn: '2026-11-10' },
    { ingredientId: 3, expiresOn: null },
    { ingredientId: 4, expiresOn: '2026-11-11' },
  ];

  it('keeps only items inside the window, soonest first', () => {
    expect(expiringIngredients(items, '2026-11-10', 3)).toEqual([
      { ingredientId: 2, expiresOn: '2026-11-10', daysLeft: 0 },
      { ingredientId: 4, expiresOn: '2026-11-11', daysLeft: 1 },
    ]);
  });

  it('reports past-date items so they can be used or discarded', () => {
    expect(expiringIngredients([{ ingredientId: 9, expiresOn: '2026-11-08' }], '2026-11-10', 3)).toEqual([
      { ingredientId: 9, expiresOn: '2026-11-08', daysLeft: -2 },
    ]);
  });

  it('returns just ids for the planner', () => {
    expect(expiringIngredientIds(items, '2026-11-10', 1)).toEqual([2, 4]);
  });

  it('formats an urgency label the UI can show', () => {
    expect(soonLabel(-1)).toBe('past date');
    expect(soonLabel(0)).toBe('today');
    expect(soonLabel(1)).toBe('tomorrow');
    expect(soonLabel(4)).toBe('4 days');
  });

  it('knows whether an item is past its date', () => {
    expect(isExpired('2026-11-09', '2026-11-10')).toBe(true);
    expect(isExpired('2026-11-10', '2026-11-10')).toBe(false);
    expect(isExpired(null, '2026-11-10')).toBe(false);
  });
});
