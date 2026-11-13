import type { SQLiteDatabase } from 'expo-sqlite';
import { RECIPE_SOURCES } from '../models';
import type { MealType, Recipe, RecipeSource } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

export interface RecipeInput {
  name: string;
  description: string | null;
  category: MealType;
  source: RecipeSource;
  isBuiltin: boolean;
  isFavorite: boolean;
  isWish: boolean;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  notes: string | null;
}

interface RecipeRow {
  id: number;
  uuid: string | null;
  name: string;
  description: string | null;
  category: MealType;
  source: RecipeSource;
  is_builtin: number;
  is_favorite: number;
  is_wish: number;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  notes: string | null;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

function parseSource(value: string): RecipeSource {
  return (RECIPE_SOURCES as readonly string[]).includes(value) ? (value as RecipeSource) : 'own';
}

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    description: row.description,
    category: row.category,
    source: parseSource(row.source),
    isBuiltin: row.is_builtin === 1,
    isFavorite: row.is_favorite === 1,
    isWish: row.is_wish === 1,
    servings: row.servings,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    notes: row.notes,
    active: row.active === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

const SELECT = `SELECT id, uuid, name, description, category, source, is_builtin, is_favorite,
                       is_wish, servings, prep_minutes, cook_minutes, notes, active, sort_order,
                       created_at, updated_at, deleted
                  FROM recipes`;

export async function getAllRecipes(db?: SQLiteDatabase): Promise<Recipe[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<RecipeRow>(
    `${SELECT} WHERE deleted = 0 ORDER BY is_favorite DESC, sort_order, name`
  );
  return rows.map(rowToRecipe);
}

export async function getRecipe(id: number, db?: SQLiteDatabase): Promise<Recipe | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<RecipeRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? rowToRecipe(row) : null;
}

export async function createRecipe(input: RecipeInput, db?: SQLiteDatabase): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO recipes
       (uuid, name, description, category, source, is_builtin, is_favorite, is_wish,
        servings, prep_minutes, cook_minutes, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUuid(),
      input.name,
      input.description,
      input.category,
      input.source,
      input.isBuiltin ? 1 : 0,
      input.isFavorite ? 1 : 0,
      input.isWish ? 1 : 0,
      input.servings,
      input.prepMinutes,
      input.cookMinutes,
      input.notes,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateRecipe(
  id: number,
  input: RecipeInput,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE recipes
        SET name = ?, description = ?, category = ?, source = ?, is_builtin = ?,
            is_favorite = ?, is_wish = ?, servings = ?, prep_minutes = ?, cook_minutes = ?,
            notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [
      input.name,
      input.description,
      input.category,
      input.source,
      input.isBuiltin ? 1 : 0,
      input.isFavorite ? 1 : 0,
      input.isWish ? 1 : 0,
      input.servings,
      input.prepMinutes,
      input.cookMinutes,
      input.notes,
      id,
    ]
  );
}

export async function setRecipeFavorite(
  id: number,
  isFavorite: boolean,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE recipes
        SET is_favorite = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [isFavorite ? 1 : 0, id]
  );
}

export async function deleteRecipe(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE recipes SET deleted = 1, active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [id]
  );
}
