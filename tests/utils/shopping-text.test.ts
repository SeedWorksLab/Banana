import type { ShoppingItem } from '../../src/models';
import { formatShoppingListText } from '../../src/utils/shopping-text';

function item(partial: Partial<ShoppingItem>): ShoppingItem {
  return {
    id: partial.id ?? 1,
    uuid: null,
    weekId: 1,
    homeId: partial.homeId ?? null,
    ingredientId: partial.ingredientId ?? null,
    label: partial.label ?? 'Item',
    category: partial.category ?? 'other',
    quantity: partial.quantity ?? 1,
    unit: partial.unit ?? 'piece',
    checked: partial.checked ?? false,
    manual: partial.manual ?? false,
    saleOnly: partial.saleOnly ?? false,
    dealId: null,
    priceCents: null,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
    deleted: partial.deleted ?? false,
  };
}

describe('formatShoppingListText', () => {
  it('groups lines in walking order with quantities', () => {
    const text = formatShoppingListText(
      [
        item({ label: 'Milk', category: 'dairy', quantity: 1, unit: 'l' }),
        item({ label: 'Apples', category: 'produce', quantity: 500, unit: 'g' }),
        item({ label: 'Salt', category: 'pantry', unit: 'to_taste' }),
      ],
      { title: 'Shopping list' }
    );
    expect(text).toBe(
      [
        'Shopping list',
        '',
        'Fruit & vegetables',
        '- [ ] Apples: 500 g',
        '',
        'Dairy & eggs',
        '- [ ] Milk: 1 l',
        '',
        'Pantry',
        '- [ ] Salt: to taste',
      ].join('\n')
    );
  });

  it('marks checked items and can omit them', () => {
    const checked = item({ label: 'Bread', category: 'bakery', checked: true });
    expect(formatShoppingListText([checked])).toContain('- [x] Bread: 1 pc');
    expect(formatShoppingListText([checked], { includeChecked: false })).toBe('Nothing to buy.');
  });

  it('ignores deleted lines', () => {
    expect(formatShoppingListText([item({ label: 'Gone', deleted: true })])).toBe('Nothing to buy.');
  });
});
