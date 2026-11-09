import type { IngredientCategory, ShoppingItem } from '../models';
import { AISLE_ROUTE } from '../services/shopping-list-service';
import { CATEGORY_LABELS, UNIT_LABELS } from './labels';

export interface ShoppingTextOptions {
  title?: string;
  includeChecked?: boolean;
}

function quantityLabel(item: ShoppingItem): string {
  if (item.unit === 'to_taste') {
    return UNIT_LABELS.to_taste;
  }
  const quantity = Math.round(item.quantity * 1000) / 1000;
  return `${quantity} ${UNIT_LABELS[item.unit]}`;
}

/**
 * A plain-text version of the shopping list for the share sheet: the Google
 * Keep app (and any notes app) accepts shared text, so no integration or
 * network call is needed. Lines follow the same walking order as the screen.
 */
export function formatShoppingListText(
  items: readonly ShoppingItem[],
  options: ShoppingTextOptions = {}
): string {
  const includeChecked = options.includeChecked ?? true;
  const visible = items.filter((item) => !item.deleted && (includeChecked || !item.checked));
  const title = options.title?.trim() ?? '';

  if (visible.length === 0) {
    return title === '' ? 'Nothing to buy.' : `${title}\n\nNothing to buy.`;
  }

  const byCategory = new Map<IngredientCategory, ShoppingItem[]>();
  for (const item of visible) {
    const group = byCategory.get(item.category);
    if (group) {
      group.push(item);
    } else {
      byCategory.set(item.category, [item]);
    }
  }

  const blocks: string[] = [];
  if (title !== '') {
    blocks.push(title);
  }
  for (const category of AISLE_ROUTE) {
    const group = byCategory.get(category);
    if (!group || group.length === 0) {
      continue;
    }
    const lines = [CATEGORY_LABELS[category]];
    for (const item of [...group].sort((a, b) => a.label.localeCompare(b.label))) {
      lines.push(`- [${item.checked ? 'x' : ' '}] ${item.label}: ${quantityLabel(item)}`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}
