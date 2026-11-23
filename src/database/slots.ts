import type { SQLiteDatabase } from 'expo-sqlite';
import { SLOT_KINDS } from '../models';
import type { MealType, Slot, SlotEvent, SlotEventKind, SlotKind, WeekDay } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

export interface SlotInput {
  weekId: number;
  day: WeekDay;
  mealType: MealType;
  kind: SlotKind;
  recipeId: number | null;
  freeText: string | null;
  servings: number;
  note: string | null;
  pinned?: boolean;
  sortOrder: number;
  batchSourceUuid?: string | null;
}

interface SlotRow {
  id: number;
  uuid: string | null;
  week_id: number;
  day: WeekDay;
  meal_type: MealType;
  kind: SlotKind;
  recipe_id: number | null;
  free_text: string | null;
  servings: number;
  note: string | null;
  pinned: number;
  cooked_at: string | null;
  rating: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
  deleted: number;
  batch_source_uuid: string | null;
}

function parseKind(value: string): SlotKind {
  return (SLOT_KINDS as readonly string[]).includes(value) ? (value as SlotKind) : 'empty';
}

function rowToSlot(row: SlotRow): Slot {
  return {
    id: row.id,
    uuid: row.uuid,
    weekId: row.week_id,
    day: row.day,
    mealType: row.meal_type,
    kind: parseKind(row.kind),
    recipeId: row.recipe_id,
    freeText: row.free_text,
    servings: row.servings,
    note: row.note,
    pinned: row.pinned === 1,
    cookedAt: row.cooked_at,
    rating: row.rating,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
    batchSourceUuid: row.batch_source_uuid,
  };
}

const SELECT = `SELECT id, uuid, week_id, day, meal_type, kind, recipe_id, free_text, servings,
                       note, pinned, cooked_at, rating, sort_order, created_at, updated_at, deleted, batch_source_uuid
                  FROM slots`;

export async function getSlotsByWeek(weekId: number, db?: SQLiteDatabase): Promise<Slot[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<SlotRow>(
    `${SELECT} WHERE week_id = ? AND deleted = 0 ORDER BY sort_order, meal_type`,
    [weekId]
  );
  return rows.map(rowToSlot);
}

export async function getSlot(id: number, db?: SQLiteDatabase): Promise<Slot | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<SlotRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? rowToSlot(row) : null;
}

export async function getRecipeHistory(
  db?: SQLiteDatabase
): Promise<{ recipeId: number; rating: number | null }[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<{ recipe_id: number; rating: number | null }>(
    `SELECT recipe_id, rating FROM slots
      WHERE deleted = 0 AND recipe_id IS NOT NULL AND cooked_at IS NOT NULL`
  );
  return rows.map((row) => ({ recipeId: row.recipe_id, rating: row.rating }));
}

export async function createSlot(input: SlotInput, db?: SQLiteDatabase): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO slots
       (uuid, week_id, day, meal_type, kind, recipe_id, free_text, servings, note, pinned, sort_order, batch_source_uuid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUuid(),
      input.weekId,
      input.day,
      input.mealType,
      input.kind,
      input.recipeId,
      input.freeText,
      input.servings,
      input.note,
      input.pinned ? 1 : 0,
      input.sortOrder,
      input.batchSourceUuid ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateSlot(
  id: number,
  input: Omit<SlotInput, 'weekId'>,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE slots
        SET day = ?, meal_type = ?, kind = ?, recipe_id = ?, free_text = ?, servings = ?,
             note = ?, pinned = ?, sort_order = ?, batch_source_uuid = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [
      input.day,
      input.mealType,
      input.kind,
      input.recipeId,
      input.freeText,
      input.servings,
      input.note,
      input.pinned ? 1 : 0,
      input.sortOrder,
      input.batchSourceUuid ?? null,
      id,
    ]
  );
}

export async function setSlotRating(
  id: number,
  rating: number | null,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE slots
        SET rating = ?, cooked_at = CASE WHEN ? IS NULL THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%fZ','now') END,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [rating, rating, id]
  );
}

export async function markSlotCooked(
  id: number,
  actual: string | null,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE slots
        SET cooked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
            note = COALESCE(?, note),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [actual, id]
  );
}

export async function deleteSlot(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE slots
        SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ? OR batch_source_uuid = (SELECT uuid FROM slots WHERE id = ?)`,
    [id, id]
  );
}

export async function recordSlotEvent(
  input: {
    slotId: number;
    kind: SlotEventKind;
    field?: string | null;
    previousValue?: string | null;
    newValue?: string | null;
    note?: string | null;
  },
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO slot_events (uuid, slot_id, kind, field, previous_value, new_value, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newUuid(),
      input.slotId,
      input.kind,
      input.field ?? null,
      input.previousValue ?? null,
      input.newValue ?? null,
      input.note ?? null,
    ]
  );
  return result.lastInsertRowId;
}

interface SlotEventRow {
  id: number;
  uuid: string | null;
  slot_id: number;
  kind: SlotEventKind;
  field: string | null;
  previous_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
  updated_at: string | null;
}

export async function getSlotEvents(
  slotId: number,
  db?: SQLiteDatabase
): Promise<SlotEvent[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<SlotEventRow>(
    `SELECT id, uuid, slot_id, kind, field, previous_value, new_value, note, created_at, updated_at
       FROM slot_events WHERE slot_id = ? ORDER BY created_at`,
    [slotId]
  );
  return rows.map((row) => ({
    id: row.id,
    uuid: row.uuid,
    slotId: row.slot_id,
    kind: row.kind,
    field: row.field,
    previousValue: row.previous_value,
    newValue: row.new_value,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
