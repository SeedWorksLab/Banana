import type { SQLiteDatabase } from 'expo-sqlite';
import type { RecipeStep } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

export interface RecipeStepInput {
  recipeId: number;
  stepIndex: number;
  instruction: string;
  durationMinutes: number | null;
}

interface RecipeStepRow {
  id: number;
  uuid: string | null;
  recipe_id: number;
  step_index: number;
  instruction: string;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string | null;
}

function rowToRecipeStep(row: RecipeStepRow): RecipeStep {
  return {
    id: row.id,
    uuid: row.uuid,
    recipeId: row.recipe_id,
    stepIndex: row.step_index,
    instruction: row.instruction,
    durationMinutes: row.duration_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, uuid, recipe_id, step_index, instruction, duration_minutes,
                       created_at, updated_at
                  FROM recipe_steps`;

export async function getRecipeSteps(
  recipeId: number,
  db?: SQLiteDatabase
): Promise<RecipeStep[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<RecipeStepRow>(
    `${SELECT} WHERE recipe_id = ? ORDER BY step_index`,
    [recipeId]
  );
  return rows.map(rowToRecipeStep);
}

export async function getAllRecipeSteps(db?: SQLiteDatabase): Promise<RecipeStep[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<RecipeStepRow>(
    `${SELECT} ORDER BY recipe_id, step_index`
  );
  return rows.map(rowToRecipeStep);
}

export async function createRecipeStep(
  input: RecipeStepInput,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO recipe_steps (uuid, recipe_id, step_index, instruction, duration_minutes)
     VALUES (?, ?, ?, ?, ?)`,
    [newUuid(), input.recipeId, input.stepIndex, input.instruction, input.durationMinutes]
  );
  return result.lastInsertRowId;
}

export async function updateRecipeStep(
  id: number,
  input: Omit<RecipeStepInput, 'recipeId'>,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE recipe_steps
        SET step_index = ?, instruction = ?, duration_minutes = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [input.stepIndex, input.instruction, input.durationMinutes, id]
  );
}

export async function deleteRecipeStep(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM recipe_steps WHERE id = ?', [id]);
}

export async function reorderRecipeSteps(
  orderedIds: readonly number[],
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.withTransactionAsync(async () => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await database.runAsync('UPDATE recipe_steps SET step_index = ? WHERE id = ?', [
        index,
        orderedIds[index],
      ]);
    }
  });
}
