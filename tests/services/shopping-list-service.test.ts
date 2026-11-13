import type { Unit } from '../../src/models';
import type { IngredientDeal } from '../../src/services/deal-service';
import {
  addManualItem,
  aggregateIngredients,
  aisleOrder,
  buildShoppingList,
  dimensionOf,
  finalizeShoppingList,
  type PlannedIngredient,
  type PlannedMeal,
  type ShoppingLine,
} from '../../src/services/shopping-list-service';

function ing(partial: Partial<PlannedIngredient>): PlannedIngredient {
  return {
    ingredientId: partial.ingredientId ?? 1,
    name: partial.name ?? 'Ingredient',
    category: partial.category ?? 'other',
    quantity: partial.quantity ?? 1,
    unit: (partial.unit ?? 'piece') as Unit,
  };
}

function meal(partial: Partial<PlannedMeal>): PlannedMeal {
  return {
    slotId: partial.slotId ?? 1,
    homeId: partial.homeId ?? null,
    servings: partial.servings ?? 2,
    recipeServings: partial.recipeServings ?? 2,
    ingredients: partial.ingredients ?? [],
  };
}

function deal(partial: { id: number; storeId: number; priceCents: number }): IngredientDeal {
  return {
    deal: {
      id: partial.id,
      storeId: partial.storeId,
      productName: 'Product',
      brand: null,
      priceCents: partial.priceCents,
      referencePriceCents: null,
      validFrom: null,
      validTo: null,
      scrapedAt: '2026-01-10T08:00:00.000Z',
    },
    confidence: 1,
    savingsCents: 0,
  };
}

describe('dimensionOf', () => {
  it('classifies mass, volume and count units', () => {
    expect(dimensionOf('g')).toBe('mass');
    expect(dimensionOf('kg')).toBe('mass');
    expect(dimensionOf('ml')).toBe('volume');
    expect(dimensionOf('l')).toBe('volume');
    expect(dimensionOf('tsp')).toBe('count');
    expect(dimensionOf('piece')).toBe('count');
  });
});

describe('aggregateIngredients', () => {
  it('scales each meal to its servings and sums compatible units', () => {
    const accums = aggregateIngredients([
      meal({ servings: 4, recipeServings: 2, ingredients: [ing({ ingredientId: 1, name: 'Flour', unit: 'g', quantity: 100 })] }),
      meal({ servings: 4, recipeServings: 4, ingredients: [ing({ ingredientId: 1, name: 'Flour', unit: 'g', quantity: 50 })] }),
    ]);
    expect(accums).toHaveLength(1);
    expect(accums[0].baseQuantity).toBe(250);
    expect(accums[0].dimension).toBe('mass');
  });

  it('keeps different count units apart', () => {
    const accums = aggregateIngredients([
      meal({
        ingredients: [
          ing({ ingredientId: 1, name: 'Salt', unit: 'tsp', quantity: 1 }),
          ing({ ingredientId: 1, name: 'Salt', unit: 'tbsp', quantity: 1 }),
        ],
      }),
    ]);
    expect(accums).toHaveLength(2);
  });

  it('converts kilos into grams while summing', () => {
    const accums = aggregateIngredients([
      meal({ ingredients: [ing({ ingredientId: 1, name: 'Rice', unit: 'kg', quantity: 1 }), ing({ ingredientId: 1, name: 'Rice', unit: 'g', quantity: 250 })] }),
    ]);
    expect(accums[0].baseQuantity).toBe(1250);
  });
});

describe('buildShoppingList', () => {
  const flourMeal = meal({
    servings: 4,
    recipeServings: 2,
    ingredients: [
      ing({ ingredientId: 1, name: 'Flour', category: 'pantry', unit: 'g', quantity: 125 }),
      ing({ ingredientId: 2, name: 'Salt', category: 'pantry', unit: 'tsp', quantity: 1 }),
    ],
  });
  const milkMeal = meal({
    servings: 4,
    recipeServings: 4,
    ingredients: [ing({ ingredientId: 3, name: 'Milk', category: 'dairy', unit: 'ml', quantity: 200 })],
  });

  it('produces one line per ingredient and groups by aisle', () => {
    const list = buildShoppingList({ meals: [flourMeal, milkMeal] });
    expect(list.lines.map((l) => `${l.label}:${l.quantity}${l.unit}`)).toEqual([
      'Milk:200ml',
      'Flour:250g',
      'Salt:2tsp',
    ]);
    expect(list.groups.map((g) => g.category)).toEqual(['dairy', 'pantry']);
    expect(list.pricedLines).toBe(0);
    expect(list.unpricedLines).toBe(3);
    expect(list.estimatedTotalCents).toBe(0);
  });

  it('subtracts a stocked pantry item', () => {
    const list = buildShoppingList({
      meals: [flourMeal],
      pantryItems: [{ ingredientId: 1, level: 'stocked', quantity: 100, unit: 'g' }],
    });
    const flour = list.lines.find((l) => l.label === 'Flour');
    expect(flour?.quantity).toBe(150);
    expect(flour?.unit).toBe('g');
  });

  it('drops a line the pantry fully covers', () => {
    const list = buildShoppingList({
      meals: [flourMeal],
      pantryItems: [{ ingredientId: 1, level: 'stocked', quantity: 1, unit: 'kg' }],
    });
    expect(list.lines.find((l) => l.label === 'Flour')).toBeUndefined();
  });

  it('shows a large amount in kilos', () => {
    const list = buildShoppingList({
      meals: [meal({ ingredients: [ing({ ingredientId: 1, name: 'Potatoes', category: 'produce', unit: 'g', quantity: 1500 })] })],
    });
    expect(list.lines[0]).toMatchObject({ label: 'Potatoes', quantity: 1.5, unit: 'kg' });
  });

  it('applies the best deal to a line and totals it', () => {
    const bestDeals = new Map<number, IngredientDeal>([[1, { ...deal({ id: 5, storeId: 2, priceCents: 199 }), savingsCents: 100 }]]);
    const list = buildShoppingList({ meals: [flourMeal, milkMeal], bestDeals });
    const flour = list.lines.find((l) => l.label === 'Flour');
    expect(flour).toMatchObject({ dealId: 5, storeId: 2, priceCents: 199, savingsCents: 100 });
    expect(list.estimatedTotalCents).toBe(199);
    expect(list.estimatedSavingsCents).toBe(100);
    expect(list.pricedLines).toBe(1);
    expect(list.unpricedLines).toBe(2);
  });
});

describe('aisle routing', () => {
  function line(partial: Partial<ShoppingLine>): ShoppingLine {
    return {
      ingredientId: partial.ingredientId ?? null,
      homeId: partial.homeId ?? null,
      label: partial.label ?? 'Item',
      category: partial.category ?? 'other',
      quantity: partial.quantity ?? 1,
      unit: partial.unit ?? 'piece',
      dealId: null,
      storeId: null,
      priceCents: null,
      savingsCents: 0,
    };
  }

  it('places fresh departments before shelf-stable aisles', () => {
    expect(aisleOrder('produce')).toBeLessThan(aisleOrder('bakery'));
    expect(aisleOrder('bakery')).toBeLessThan(aisleOrder('dairy'));
    expect(aisleOrder('pantry')).toBeLessThan(aisleOrder('household'));
    expect(aisleOrder('household')).toBeLessThan(aisleOrder('other'));
  });

  it('sorts the list and its groups by the walking route, not alphabetically', () => {
    const list = finalizeShoppingList([
      line({ label: 'Kitchen roll', category: 'household' }),
      line({ label: 'Apples', category: 'produce' }),
      line({ label: 'Rice', category: 'pantry' }),
      line({ label: 'Bread', category: 'bakery' }),
      line({ label: 'Milk', category: 'dairy' }),
    ]);
    expect(list.groups.map((group) => group.category)).toEqual([
      'produce',
      'bakery',
      'dairy',
      'pantry',
      'household',
    ]);
    expect(list.lines.map((entry) => entry.label)).toEqual([
      'Apples',
      'Bread',
      'Milk',
      'Rice',
      'Kitchen roll',
    ]);
  });
});

describe('addManualItem', () => {
  it('adds a manual line and re-sorts', () => {
    const list = buildShoppingList({
      meals: [meal({ ingredients: [ing({ ingredientId: 1, name: 'Milk', category: 'dairy', unit: 'ml', quantity: 200 })] })],
    });
    const next = addManualItem(list, {
      ingredientId: null,
      homeId: null,
      label: 'Kitchen roll',
      category: 'household',
      quantity: 1,
      unit: 'pack',
      dealId: null,
      storeId: null,
      priceCents: null,
      savingsCents: 0,
    });
    expect(next.lines.map((l) => l.label)).toEqual(['Milk', 'Kitchen roll']);
    expect(next.groups.map((g) => g.category)).toEqual(['dairy', 'household']);
  });
});
