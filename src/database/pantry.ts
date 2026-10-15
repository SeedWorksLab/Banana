import type { SQLiteDatabase } from 'expo-sqlite';
import type { PantryItem, PantryLevel, Unit } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

export interface PantryItemInput {
  ingredientId: number;
  level: PantryLevel;
  quantity: number | null;
  unit: Unit | null;
}

interface PantryRow {
  id: number;
  uuid: string | null;
  ingredient_id: number;
  level: PantryLevel;
  quantity: number | null;
  unit: Unit | null;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

function rowToPantryItem(row: PantryRow): PantryItem {
  return {
    id: row.id,
    uuid: row.uuid,
    ingredientId: row.ingredient_id,
    level: row.level,
    quantity: row.quantity,
    unit: row.unit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

const SELECT = `SELECT id, uuid, ingredient_id, level, quantity, unit, created_at, updated_at, deleted
                  FROM pantry`;

export async function getAllPantryItems(db?: SQLiteDatabase): Promise<PantryItem[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<PantryRow>(`${SELECT} WHERE deleted = 0`);
  return rows.map(rowToPantryItem);
}

export async function getPantryItem(
  ingredientId: number,
  db?: SQLiteDatabase
): Promise<PantryItem | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<PantryRow>(
    `${SELECT} WHERE ingredient_id = ? AND deleted = 0`,
    [ingredientId]
  );
  return row ? rowToPantryItem(row) : null;
}

export async function upsertPantryItem(
  input: PantryItemInput,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `INSERT INTO pantry (uuid, ingredient_id, level, quantity, unit)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (ingredient_id) DO UPDATE
       SET level = excluded.level, quantity = excluded.quantity, unit = excluded.unit,
           deleted = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    [newUuid(), input.ingredientId, input.level, input.quantity, input.unit]
  );
}

export async function setPantryLevel(
  ingredientId: number,
  level: PantryLevel,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `INSERT INTO pantry (uuid, ingredient_id, level)
     VALUES (?, ?, ?)
     ON CONFLICT (ingredient_id) DO UPDATE
       SET level = excluded.level, deleted = 0,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    [newUuid(), ingredientId, level]
  );
}

export async function deletePantryItem(
  ingredientId: number,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE pantry
        SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE ingredient_id = ?`,
    [ingredientId]
  );
}
