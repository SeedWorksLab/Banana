import type { SQLiteDatabase } from 'expo-sqlite';
import type { IngredientAlias } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

interface IngredientAliasRow {
  id: number;
  uuid: string | null;
  ingredient_id: number;
  alias: string;
  created_at: string;
  updated_at: string | null;
}

function rowToIngredientAlias(row: IngredientAliasRow): IngredientAlias {
  return {
    id: row.id,
    uuid: row.uuid,
    ingredientId: row.ingredient_id,
    alias: row.alias,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, uuid, ingredient_id, alias, created_at, updated_at FROM ingredient_aliases`;

export async function getAllIngredientAliases(
  db?: SQLiteDatabase
): Promise<IngredientAlias[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<IngredientAliasRow>(`${SELECT} ORDER BY alias`);
  return rows.map(rowToIngredientAlias);
}

export async function getAliasesForIngredient(
  ingredientId: number,
  db?: SQLiteDatabase
): Promise<IngredientAlias[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<IngredientAliasRow>(
    `${SELECT} WHERE ingredient_id = ? ORDER BY alias`,
    [ingredientId]
  );
  return rows.map(rowToIngredientAlias);
}

export async function addIngredientAlias(
  ingredientId: number,
  alias: string,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    'INSERT OR IGNORE INTO ingredient_aliases (uuid, ingredient_id, alias) VALUES (?, ?, ?)',
    [newUuid(), ingredientId, alias.trim().toLowerCase()]
  );
  return result.lastInsertRowId;
}

export async function deleteIngredientAlias(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM ingredient_aliases WHERE id = ?', [id]);
}
