import {
  canCookFromPantry,
  findPantryItem,
  pantryCoverage,
  pantryLevelFor,
  shortage,
  stockingSuggestions,
  type PantryLookupItem,
} from '../../src/services/pantry-service';

function item(partial: Partial<PantryLookupItem>): PantryLookupItem {
  return {
    ingredientId: partial.ingredientId ?? 1,
    level: partial.level ?? 'stocked',
    quantity: partial.quantity === undefined ? null : partial.quantity,
    unit: partial.unit === undefined ? null : partial.unit,
  };
}

describe('shortage', () => {
  it('needs everything when the pantry is empty of the item', () => {
    expect(shortage({ quantity: 100, unit: 'g' }, null)).toEqual({ quantity: 100, unit: 'g' });
  });

  it('subtracts a stocked amount in a compatible unit', () => {
    const result = shortage({ quantity: 100, unit: 'g' }, item({ level: 'stocked', quantity: 40, unit: 'g' }));
    expect(result).toEqual({ quantity: 60, unit: 'g' });
  });

  it('subtracts across mass units', () => {
    const result = shortage({ quantity: 500, unit: 'g' }, item({ level: 'stocked', quantity: 1, unit: 'kg' }));
    expect(result).toBeNull();
  });

  it('needs nothing when the pantry fully covers the amount', () => {
    expect(shortage({ quantity: 100, unit: 'g' }, item({ level: 'stocked', quantity: 150, unit: 'g' }))).toBeNull();
  });

  it('treats low and out as needing everything', () => {
    expect(shortage({ quantity: 100, unit: 'g' }, item({ level: 'low', quantity: 90, unit: 'g' }))).toEqual({ quantity: 100, unit: 'g' });
    expect(shortage({ quantity: 100, unit: 'g' }, item({ level: 'out', quantity: 0, unit: 'g' }))).toEqual({ quantity: 100, unit: 'g' });
  });

  it('needs everything when the units cannot be compared', () => {
    expect(shortage({ quantity: 100, unit: 'g' }, item({ level: 'stocked', quantity: 3, unit: 'piece' }))).toEqual({ quantity: 100, unit: 'g' });
  });

  it('needs nothing for a non-positive requirement', () => {
    expect(shortage({ quantity: 0, unit: 'g' }, null)).toBeNull();
  });
});

describe('findPantryItem', () => {
  const items = [item({ ingredientId: 4, level: 'low' }), item({ ingredientId: 9, level: 'out' })];

  it('finds by ingredient id', () => {
    expect(findPantryItem(items, 9)?.level).toBe('out');
  });

  it('returns null when absent', () => {
    expect(findPantryItem(items, 1)).toBeNull();
  });
});

describe('pantryLevelFor', () => {
  it('returns the level or null', () => {
    expect(pantryLevelFor([item({ ingredientId: 2, level: 'stocked' })], 2)).toBe('stocked');
    expect(pantryLevelFor([], 2)).toBeNull();
  });
});

describe('stockingSuggestions', () => {
  it('suggests everything that is not stocked', () => {
    const suggestions = stockingSuggestions([
      item({ ingredientId: 1, level: 'stocked' }),
      item({ ingredientId: 2, level: 'low' }),
      item({ ingredientId: 3, level: 'out' }),
    ]);
    expect(suggestions).toEqual([
      { ingredientId: 2, level: 'low' },
      { ingredientId: 3, level: 'out' },
    ]);
  });
});

describe('pantryCoverage', () => {
  const items = [
    item({ ingredientId: 1, level: 'stocked' }),
    item({ ingredientId: 2, level: 'low' }),
    item({ ingredientId: 3, level: 'out' }),
  ];

  it('splits required ingredients into have and need', () => {
    expect(pantryCoverage([1, 2, 3, 4, 1], items)).toEqual({
      stocked: [1],
      low: [2],
      out: [3],
      unknown: [4],
      missing: [2, 3, 4],
    });
  });

  it('says a recipe can be cooked when everything is stocked', () => {
    expect(canCookFromPantry([1], items)).toBe(true);
    expect(canCookFromPantry([1, 2], items)).toBe(false);
  });

  it('treats a recipe with no ingredients as cookable', () => {
    expect(canCookFromPantry([], items)).toBe(true);
  });
});
