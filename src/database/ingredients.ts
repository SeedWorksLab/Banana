import type { SQLiteDatabase } from 'expo-sqlite';
import type { Ingredient, IngredientCategory, Unit } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

export interface IngredientInput {
  name: string;
  category: IngredientCategory;
  defaultUnit: Unit;
  defaultQuantity: number | null;
  isPantryStaple: boolean;
  notes: string | null;
}

interface IngredientRow {
  id: number;
  uuid: string | null;
  name: string;
  category: IngredientCategory;
  default_unit: Unit;
  default_quantity: number | null;
  is_pantry_staple: number;
  notes: string | null;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

function rowToIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    category: row.category,
    defaultUnit: row.default_unit,
    defaultQuantity: row.default_quantity,
    isPantryStaple: row.is_pantry_staple === 1,
    notes: row.notes,
    active: row.active === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

const SELECT = `SELECT id, uuid, name, category, default_unit, default_quantity,
                       is_pantry_staple, notes, active, sort_order, created_at, updated_at, deleted
                  FROM ingredients`;

export async function getAllIngredients(db?: SQLiteDatabase): Promise<Ingredient[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<IngredientRow>(
    `${SELECT} WHERE deleted = 0 ORDER BY sort_order, name`
  );
  return rows.map(rowToIngredient);
}

export async function getIngredient(id: number, db?: SQLiteDatabase): Promise<Ingredient | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<IngredientRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? rowToIngredient(row) : null;
}

export async function getIngredientsByCategory(
  category: IngredientCategory,
  db?: SQLiteDatabase
): Promise<Ingredient[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<IngredientRow>(
    `${SELECT} WHERE deleted = 0 AND category = ? ORDER BY sort_order, name`,
    [category]
  );
  return rows.map(rowToIngredient);
}

export async function createIngredient(
  input: IngredientInput,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO ingredients
       (uuid, name, category, default_unit, default_quantity, is_pantry_staple, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newUuid(),
      input.name,
      input.category,
      input.defaultUnit,
      input.defaultQuantity,
      input.isPantryStaple ? 1 : 0,
      input.notes,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateIngredient(
  id: number,
  input: IngredientInput,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE ingredients
        SET name = ?, category = ?, default_unit = ?, default_quantity = ?,
            is_pantry_staple = ?, notes = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [
      input.name,
      input.category,
      input.defaultUnit,
      input.defaultQuantity,
      input.isPantryStaple ? 1 : 0,
      input.notes,
      id,
    ]
  );
}

export async function deleteIngredient(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE ingredients
        SET deleted = 1, active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [id]
  );
}
