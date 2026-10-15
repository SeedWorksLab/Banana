import type { SQLiteDatabase } from 'expo-sqlite';
import { INGREDIENT_CATEGORIES, UNITS } from '../models';
import type { IngredientCategory, ShoppingItem, Unit } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

export interface ShoppingItemInput {
  weekId: number;
  ingredientId: number | null;
  label: string;
  category: IngredientCategory;
  quantity: number;
  unit: Unit;
  checked: boolean;
  manual: boolean;
  dealId: number | null;
  priceCents: number | null;
  sortOrder: number;
}

interface ShoppingItemRow {
  id: number;
  uuid: string | null;
  week_id: number;
  ingredient_id: number | null;
  label: string;
  category: IngredientCategory;
  quantity: number;
  unit: Unit;
  checked: number;
  manual: number;
  deal_id: number | null;
  price_cents: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

function parseCategory(value: string): IngredientCategory {
  return (INGREDIENT_CATEGORIES as readonly string[]).includes(value)
    ? (value as IngredientCategory)
    : 'other';
}

function parseUnit(value: string): Unit {
  return (UNITS as readonly string[]).includes(value) ? (value as Unit) : 'piece';
}

function rowToShoppingItem(row: ShoppingItemRow): ShoppingItem {
  return {
    id: row.id,
    uuid: row.uuid,
    weekId: row.week_id,
    ingredientId: row.ingredient_id,
    label: row.label,
    category: parseCategory(row.category),
    quantity: row.quantity,
    unit: parseUnit(row.unit),
    checked: row.checked === 1,
    manual: row.manual === 1,
    dealId: row.deal_id,
    priceCents: row.price_cents,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

const SELECT = `SELECT id, uuid, week_id, ingredient_id, label, category, quantity, unit,
                       checked, manual, deal_id, price_cents, sort_order,
                       created_at, updated_at, deleted
                  FROM shopping_items`;

export async function getShoppingItems(
  weekId: number,
  db?: SQLiteDatabase
): Promise<ShoppingItem[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<ShoppingItemRow>(
    `${SELECT} WHERE week_id = ? AND deleted = 0 ORDER BY category, sort_order, label`,
    [weekId]
  );
  return rows.map(rowToShoppingItem);
}

export async function getShoppingItem(
  id: number,
  db?: SQLiteDatabase
): Promise<ShoppingItem | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<ShoppingItemRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? rowToShoppingItem(row) : null;
}

export async function createShoppingItem(
  input: ShoppingItemInput,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO shopping_items
       (uuid, week_id, ingredient_id, label, category, quantity, unit, checked, manual,
        deal_id, price_cents, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUuid(),
      input.weekId,
      input.ingredientId,
      input.label,
      input.category,
      input.quantity,
      input.unit,
      input.checked ? 1 : 0,
      input.manual ? 1 : 0,
      input.dealId,
      input.priceCents,
      input.sortOrder,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateShoppingItem(
  id: number,
  input: Omit<ShoppingItemInput, 'weekId' | 'manual'>,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE shopping_items
        SET ingredient_id = ?, label = ?, category = ?, quantity = ?, unit = ?, checked = ?,
            deal_id = ?, price_cents = ?, sort_order = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [
      input.ingredientId,
      input.label,
      input.category,
      input.quantity,
      input.unit,
      input.checked ? 1 : 0,
      input.dealId,
      input.priceCents,
      input.sortOrder,
      id,
    ]
  );
}

export async function setShoppingItemChecked(
  id: number,
  checked: boolean,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE shopping_items
        SET checked = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [checked ? 1 : 0, id]
  );
}

export async function deleteShoppingItem(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE shopping_items
        SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [id]
  );
}

/**
 * Rebuilds the derived part of a week's list. Manual items are preserved;
 * everything else is replaced by what the shopping-list service computed.
 */
export async function replaceGeneratedShoppingItems(
  weekId: number,
  items: readonly ShoppingItemInput[],
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE shopping_items
          SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE week_id = ? AND manual = 0 AND deleted = 0`,
      [weekId]
    );
    for (const item of items) {
      await createShoppingItem(item, database);
    }
  });
}

export async function clearGeneratedShoppingItems(
  weekId: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE shopping_items
        SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE week_id = ? AND manual = 0`,
    [weekId]
  );
}
