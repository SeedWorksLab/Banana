import type { SQLiteDatabase } from 'expo-sqlite';
import type { RecipeIngredient, Unit } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

export interface RecipeIngredientInput {
  recipeId: number;
  ingredientId: number;
  quantity: number;
  unit: Unit;
  note: string | null;
  optional: boolean;
  sortOrder: number;
}

interface RecipeIngredientRow {
  id: number;
  uuid: string | null;
  recipe_id: number;
  ingredient_id: number;
  quantity: number;
  unit: Unit;
  note: string | null;
  optional: number;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
}

function rowToRecipeIngredient(row: RecipeIngredientRow): RecipeIngredient {
  return {
    id: row.id,
    uuid: row.uuid,
    recipeId: row.recipe_id,
    ingredientId: row.ingredient_id,
    quantity: row.quantity,
    unit: row.unit,
    note: row.note,
    optional: row.optional === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, uuid, recipe_id, ingredient_id, quantity, unit, note,
                       optional, sort_order, created_at, updated_at
                  FROM recipe_ingredients`;

export async function getRecipeIngredients(
  recipeId: number,
  db?: SQLiteDatabase
): Promise<RecipeIngredient[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<RecipeIngredientRow>(
    `${SELECT} WHERE recipe_id = ? ORDER BY sort_order, id`,
    [recipeId]
  );
  return rows.map(rowToRecipeIngredient);
}

export async function getAllRecipeIngredients(
  db?: SQLiteDatabase
): Promise<RecipeIngredient[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<RecipeIngredientRow>(
    `${SELECT} ORDER BY recipe_id, sort_order, id`
  );
  return rows.map(rowToRecipeIngredient);
}

export async function createRecipeIngredient(
  input: RecipeIngredientInput,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO recipe_ingredients
       (uuid, recipe_id, ingredient_id, quantity, unit, note, optional, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUuid(),
      input.recipeId,
      input.ingredientId,
      input.quantity,
      input.unit,
      input.note,
      input.optional ? 1 : 0,
      input.sortOrder,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateRecipeIngredient(
  id: number,
  input: Omit<RecipeIngredientInput, 'recipeId'>,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE recipe_ingredients
        SET ingredient_id = ?, quantity = ?, unit = ?, note = ?, optional = ?, sort_order = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [
      input.ingredientId,
      input.quantity,
      input.unit,
      input.note,
      input.optional ? 1 : 0,
      input.sortOrder,
      id,
    ]
  );
}

export async function deleteRecipeIngredient(
  id: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM recipe_ingredients WHERE id = ?', [id]);
}

export async function reorderRecipeIngredients(
  orderedIds: readonly number[],
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await database.runAsync('UPDATE recipe_ingredients SET sort_order = ? WHERE id = ?', [
        index,
        orderedIds[index],
      ]);
    }
  });
}
