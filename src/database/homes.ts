import type { SQLiteDatabase } from 'expo-sqlite';
import type { Home } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

export interface HomeInput {
  name: string;
}

interface HomeRow {
  id: number;
  uuid: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

function rowToHome(row: HomeRow): Home {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

const SELECT = `SELECT id, uuid, name, sort_order, created_at, updated_at, deleted FROM homes`;

export async function getAllHomes(db?: SQLiteDatabase): Promise<Home[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<HomeRow>(
    `${SELECT} WHERE deleted = 0 ORDER BY sort_order, id`
  );
  return rows.map(rowToHome);
}

export async function getHome(id: number, db?: SQLiteDatabase): Promise<Home | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<HomeRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? rowToHome(row) : null;
}

export async function getDefaultHome(db?: SQLiteDatabase): Promise<Home> {
  const database = db ?? (await getDatabase());
  const homes = await getAllHomes(database);
  if (homes.length > 0) {
    return homes[0];
  }
  const id = await createHome({ name: 'Home' }, database);
  const created = await getHome(id, database);
  if (!created) {
    throw new Error('Failed to create the default home');
  }
  return created;
}

export async function createHome(input: HomeInput, db?: SQLiteDatabase): Promise<number> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM homes'
  );
  const result = await database.runAsync(
    'INSERT INTO homes (uuid, name, sort_order) VALUES (?, ?, ?)',
    [newUuid(), input.name, row?.next ?? 0]
  );
  return result.lastInsertRowId;
}

export async function updateHome(
  id: number,
  input: HomeInput,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE homes
        SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [input.name, id]
  );
}

export async function deleteHome(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE homes
        SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [id]
  );
}
