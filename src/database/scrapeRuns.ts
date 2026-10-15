import type { SQLiteDatabase } from 'expo-sqlite';
import { SCRAPE_RUN_STATUSES } from '../models';
import type { ScrapeRun, ScrapeRunStatus } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

interface ScrapeRunRow {
  id: number;
  uuid: string | null;
  store_id: number;
  status: ScrapeRunStatus;
  deals_found: number;
  deals_new: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string | null;
}

function parseStatus(value: string): ScrapeRunStatus {
  return (SCRAPE_RUN_STATUSES as readonly string[]).includes(value)
    ? (value as ScrapeRunStatus)
    : 'failed';
}

function rowToScrapeRun(row: ScrapeRunRow): ScrapeRun {
  return {
    id: row.id,
    uuid: row.uuid,
    storeId: row.store_id,
    status: parseStatus(row.status),
    dealsFound: row.deals_found,
    dealsNew: row.deals_new,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, uuid, store_id, status, deals_found, deals_new, error,
                       started_at, finished_at, created_at, updated_at
                  FROM scrape_runs`;

export async function getScrapeRuns(
  limit = 50,
  db?: SQLiteDatabase
): Promise<ScrapeRun[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<ScrapeRunRow>(
    `${SELECT} ORDER BY started_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(rowToScrapeRun);
}

export async function getLastScrapeRun(
  storeId: number,
  db?: SQLiteDatabase
): Promise<ScrapeRun | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<ScrapeRunRow>(
    `${SELECT} WHERE store_id = ? ORDER BY started_at DESC LIMIT 1`,
    [storeId]
  );
  return row ? rowToScrapeRun(row) : null;
}

export async function createScrapeRun(
  input: Omit<ScrapeRun, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>,
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO scrape_runs
       (uuid, store_id, status, deals_found, deals_new, error, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUuid(),
      input.storeId,
      input.status,
      input.dealsFound,
      input.dealsNew,
      input.error,
      input.startedAt,
      input.finishedAt,
    ]
  );
  return result.lastInsertRowId;
}
