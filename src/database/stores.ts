import type { SQLiteDatabase } from 'expo-sqlite';
import type { Store, StoreId } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

interface StoreRow {
  id: number;
  uuid: string | null;
  store_id: StoreId;
  name: string;
  offers_url: string;
  enabled: number;
  last_scraped_at: string | null;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

function rowToStore(row: StoreRow): Store {
  return {
    id: row.id,
    uuid: row.uuid,
    storeId: row.store_id,
    name: row.name,
    offersUrl: row.offers_url,
    enabled: row.enabled === 1,
    lastScrapedAt: row.last_scraped_at,
    active: row.active === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

const SELECT = `SELECT id, uuid, store_id, name, offers_url, enabled, last_scraped_at,
                       active, sort_order, created_at, updated_at, deleted
                  FROM stores`;

export async function getAllStores(db?: SQLiteDatabase): Promise<Store[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<StoreRow>(
    `${SELECT} WHERE deleted = 0 ORDER BY sort_order`
  );
  return rows.map(rowToStore);
}

export async function getEnabledStores(db?: SQLiteDatabase): Promise<Store[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<StoreRow>(
    `${SELECT} WHERE deleted = 0 AND enabled = 1 ORDER BY sort_order`
  );
  return rows.map(rowToStore);
}

export async function getStore(id: number, db?: SQLiteDatabase): Promise<Store | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<StoreRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? rowToStore(row) : null;
}

export async function getStoreByStoreId(
  storeId: StoreId,
  db?: SQLiteDatabase
): Promise<Store | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<StoreRow>(
    `${SELECT} WHERE store_id = ? AND deleted = 0`,
    [storeId]
  );
  return row ? rowToStore(row) : null;
}

export async function setStoreEnabled(
  id: number,
  enabled: boolean,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE stores
        SET enabled = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [enabled ? 1 : 0, id]
  );
}

export async function setStoreOffersUrl(
  id: number,
  offersUrl: string,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE stores
        SET offers_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [offersUrl, id]
  );
}

export async function markStoreScraped(
  id: number,
  scrapedAt: string,
  db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE stores
        SET last_scraped_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [scrapedAt, id]
  );
}

export async function createStore(
  input: { storeId: StoreId; name: string; offersUrl: string; enabled: boolean; sortOrder: number },
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  const result = await database.runAsync(
    `INSERT INTO stores (uuid, store_id, name, offers_url, enabled, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newUuid(), input.storeId, input.name, input.offersUrl, input.enabled ? 1 : 0, input.sortOrder]
  );
  return result.lastInsertRowId;
}
