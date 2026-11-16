import { wishRecipeShoppingLines } from '../../src/services/wish-recipe-service';

describe('wish recipe shopping lines', () => {
  it('buys only what the home does not already have', () => {
    const lines = wishRecipeShoppingLines(
      [
        { ingredientId: 1, name: 'Flour', category: 'pantry', quantity: 500, unit: 'g', optional: false },
        { ingredientId: 2, name: 'Eggs', category: 'dairy', quantity: 4, unit: 'piece', optional: false },
        { ingredientId: 3, name: 'Butter', category: 'dairy', quantity: 100, unit: 'g', optional: false },
      ],
      [
        { ingredientId: 1, homeId: 1, level: 'stocked', quantity: 200, unit: 'g' },
        { ingredientId: 2, homeId: 1, level: 'stocked', quantity: 6, unit: 'piece' },
      ]
    );
    expect(lines).toEqual([
      { ingredientId: 1, label: 'Flour', category: 'pantry', quantity: 300, unit: 'g' },
      { ingredientId: 3, label: 'Butter', category: 'dairy', quantity: 100, unit: 'g' },
    ]);
  });

  it('ignores optional ingredients', () => {
    const lines = wishRecipeShoppingLines(
      [
        { ingredientId: 1, name: 'Flour', category: 'pantry', quantity: 500, unit: 'g', optional: false },
        { ingredientId: 2, name: 'Sprinkles', category: 'pantry', quantity: 20, unit: 'g', optional: true },
      ],
      []
    );
    expect(lines.map((line) => line.ingredientId)).toEqual([1]);
  });

  it('subtracts known amounts even when their rough stock level is low', () => {
    const lines = wishRecipeShoppingLines(
      [
        { ingredientId: 1, name: 'Milk', category: 'dairy', quantity: 1, unit: 'l', optional: false },
        { ingredientId: 2, name: 'Cocoa', category: 'pantry', quantity: 50, unit: 'g', optional: false },
      ],
      [
        { ingredientId: 1, homeId: 1, level: 'low', quantity: 250, unit: 'ml' },
        { ingredientId: 2, homeId: 1, level: 'stocked', quantity: 50, unit: 'g' },
      ]
    );
    expect(lines).toEqual([
      { ingredientId: 1, label: 'Milk', category: 'dairy', quantity: 0.75, unit: 'l' },
    ]);
  });
});
