import type { SQLiteDatabase } from 'expo-sqlite';
import { MATCH_STATUSES } from '../models';
import type { DealMatch, MatchStatus } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

interface DealMatchRow {
  id: number;
  uuid: string | null;
  deal_id: number;
  ingredient_id: number;
  confidence: number;
  status: MatchStatus;
  created_at: string;
  updated_at: string | null;
}

function parseStatus(value: string): MatchStatus {
  return (MATCH_STATUSES as readonly string[]).includes(value) ? (value as MatchStatus) : 'auto';
}

function rowToDealMatch(row: DealMatchRow): DealMatch {
  return {
    id: row.id,
    uuid: row.uuid,
    dealId: row.deal_id,
    ingredientId: row.ingredient_id,
    confidence: row.confidence,
    status: parseStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, uuid, deal_id, ingredient_id, confidence, status, created_at, updated_at
                  FROM deal_matches`;

export async function getMatchesForDeal(
  dealId: number,
  db?: SQLiteDatabase
): Promise<DealMatch[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<DealMatchRow>(
    `${SELECT} WHERE deal_id = ? ORDER BY confidence DESC`,
    [dealId]
  );
  return rows.map(rowToDealMatch);
}

export async function getMatchesForIngredient(
  ingredientId: number,
  db?: SQLiteDatabase
): Promise<DealMatch[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<DealMatchRow>(
    `${SELECT} WHERE ingredient_id = ? AND status != 'rejected' ORDER BY confidence DESC`,
    [ingredientId]
  );
  return rows.map(rowToDealMatch);
}

export async function getAllDealMatches(db?: SQLiteDatabase): Promise<DealMatch[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<DealMatchRow>(
    `${SELECT} WHERE status != 'rejected' ORDER BY ingredient_id, confidence DESC`
  );
  return rows.map(rowToDealMatch);
}

export async function upsertDealMatch(
  input: { dealId: number; ingredientId: number; confidence: number; status: MatchStatus },
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `INSERT INTO deal_matches (uuid, deal_id, ingredient_id, confidence, status)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (deal_id, ingredient_id) DO UPDATE
       SET confidence = excluded.confidence, status = excluded.status,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    [newUuid(), input.dealId, input.ingredientId, input.confidence, input.status]
  );
}

/**
 * Records a newly discovered match without ever overwriting a status the user
 * has already confirmed or rejected. Refresh runs are idempotent for matches.
 */
export async function ensureDealMatch(
  input: { dealId: number; ingredientId: number; confidence: number },
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `INSERT OR IGNORE INTO deal_matches (uuid, deal_id, ingredient_id, confidence, status)
     VALUES (?, ?, ?, ?, 'auto')`,
    [newUuid(), input.dealId, input.ingredientId, input.confidence]
  );
}

export async function setDealMatchStatus(
  id: number,
  status: MatchStatus,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE deal_matches
        SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [status, id]
  );
}

export async function deleteDealMatch(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync('DELETE FROM deal_matches WHERE id = ?', [id]);
}
