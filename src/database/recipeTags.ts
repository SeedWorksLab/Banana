import type { SQLiteDatabase } from 'expo-sqlite';
import type { RecipeTag } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

interface RecipeTagRow {
  id: number;
  uuid: string | null;
  recipe_id: number;
  tag: string;
  created_at: string;
  updated_at: string | null;
}

function rowToRecipeTag(row: RecipeTagRow): RecipeTag {
  return {
    id: row.id,
    uuid: row.uuid,
    recipeId: row.recipe_id,
    tag: row.tag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getRecipeTags(
  recipeId: number,
  db?: SQLiteDatabase
): Promise<RecipeTag[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<RecipeTagRow>(
    'SELECT id, uuid, recipe_id, tag, created_at, updated_at FROM recipe_tags WHERE recipe_id = ? ORDER BY tag',
    [recipeId]
  );
  return rows.map(rowToRecipeTag);
}

export async function getAllRecipeTags(db?: SQLiteDatabase): Promise<RecipeTag[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<RecipeTagRow>(
    'SELECT id, uuid, recipe_id, tag, created_at, updated_at FROM recipe_tags ORDER BY recipe_id, tag'
  );
  return rows.map(rowToRecipeTag);
}

export async function addRecipeTag(
  recipeId: number,
  tag: string,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    'INSERT OR IGNORE INTO recipe_tags (uuid, recipe_id, tag) VALUES (?, ?, ?)',
    [newUuid(), recipeId, tag.trim()]
  );
  return result.lastInsertRowId;
}

export async function setRecipeTags(
  recipeId: number,
  tags: readonly string[],
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM recipe_tags WHERE recipe_id = ?', [recipeId]);
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (tag.trim() === '') continue;
    await database.runAsync(
      'INSERT OR IGNORE INTO recipe_tags (uuid, recipe_id, tag) VALUES (?, ?, ?)',
      [newUuid(), recipeId, trimmed]
    );
  }
}

export async function deleteRecipeTag(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM recipe_tags WHERE id = ?', [id]);
}
