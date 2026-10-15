import type { SQLiteDatabase } from 'expo-sqlite';
import { WEEK_STATUSES } from '../models';
import type { Week, WeekStatus } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

interface WeekRow {
  id: number;
  uuid: string | null;
  week_start_date: string;
  status: WeekStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

function parseStatus(value: string): WeekStatus {
  return (WEEK_STATUSES as readonly string[]).includes(value) ? (value as WeekStatus) : 'planning';
}

function rowToWeek(row: WeekRow): Week {
  return {
    id: row.id,
    uuid: row.uuid,
    weekStartDate: row.week_start_date,
    status: parseStatus(row.status),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

const SELECT = `SELECT id, uuid, week_start_date, status, notes, created_at, updated_at, deleted
                  FROM weeks`;

export async function getAllWeeks(db?: SQLiteDatabase): Promise<Week[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<WeekRow>(
    `${SELECT} WHERE deleted = 0 ORDER BY week_start_date DESC`
  );
  return rows.map(rowToWeek);
}

export async function getWeek(id: number, db?: SQLiteDatabase): Promise<Week | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<WeekRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? rowToWeek(row) : null;
}

export async function getWeekByStartDate(
  weekStartDate: string,
  db?: SQLiteDatabase
): Promise<Week | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<WeekRow>(
    `${SELECT} WHERE week_start_date = ?`,
    [weekStartDate]
  );
  return row ? rowToWeek(row) : null;
}

export async function createWeek(
  input: { weekStartDate: string; status: WeekStatus; notes: string | null },
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    'INSERT INTO weeks (uuid, week_start_date, status, notes) VALUES (?, ?, ?, ?)',
    [newUuid(), input.weekStartDate, input.status, input.notes]
  );
  return result.lastInsertRowId;
}

export async function ensureWeek(
  weekStartDate: string,
  db?: SQLiteDatabase
): Promise<Week> {
  const existing = await getWeekByStartDate(weekStartDate, db);
  if (existing) {
    return existing;
  }
  const id = await createWeek({ weekStartDate, status: 'planning', notes: null }, db);
  const created = await getWeek(id, db);
  if (!created) {
    throw new Error('Failed to create week');
  }
  return created;
}

export async function setWeekStatus(
  id: number,
  status: WeekStatus,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE weeks
        SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [status, id]
  );
}

export async function updateWeekNotes(
  id: number,
  notes: string | null,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE weeks
        SET notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [notes, id]
  );
}

export async function deleteWeek(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE weeks
        SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [id]
  );
}
