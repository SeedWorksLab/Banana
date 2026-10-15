import type { SQLiteDatabase } from 'expo-sqlite';
import type { Deal } from '../models';
import { newUuid } from '../utils/uuid';
import { getDatabase } from './database';

export interface DealInput {
  storeId: number;
  productName: string;
  brand: string | null;
  priceCents: number;
  referencePriceCents: number | null;
  unit: string | null;
  quantityText: string | null;
  validFrom: string | null;
  validTo: string | null;
  sourceUrl: string | null;
  scrapedAt: string;
}

interface DealRow {
  id: number;
  uuid: string | null;
  store_id: number;
  product_name: string;
  brand: string | null;
  price_cents: number;
  reference_price_cents: number | null;
  unit: string | null;
  quantity_text: string | null;
  valid_from: string | null;
  valid_to: string | null;
  source_url: string | null;
  scraped_at: string;
  created_at: string;
  updated_at: string | null;
  deleted: number;
}

function rowToDeal(row: DealRow): Deal {
  return {
    id: row.id,
    uuid: row.uuid,
    storeId: row.store_id,
    productName: row.product_name,
    brand: row.brand,
    priceCents: row.price_cents,
    referencePriceCents: row.reference_price_cents,
    unit: row.unit,
    quantityText: row.quantity_text,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    sourceUrl: row.source_url,
    scrapedAt: row.scraped_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  };
}

const SELECT = `SELECT id, uuid, store_id, product_name, brand, price_cents,
                       reference_price_cents, unit, quantity_text, valid_from, valid_to,
                       source_url, scraped_at, created_at, updated_at, deleted
                  FROM deals`;

export async function getAllDeals(db?: SQLiteDatabase): Promise<Deal[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<DealRow>(
    `${SELECT} WHERE deleted = 0 ORDER BY product_name`
  );
  return rows.map(rowToDeal);
}

export async function getDealsByStore(
  storeId: number,
  db?: SQLiteDatabase
): Promise<Deal[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<DealRow>(
    `${SELECT} WHERE store_id = ? AND deleted = 0 ORDER BY product_name`,
    [storeId]
  );
  return rows.map(rowToDeal);
}

export async function getCurrentDeals(
  today: string,
  db?: SQLiteDatabase
): Promise<Deal[]> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<DealRow>(
    `${SELECT}
      WHERE deleted = 0
        AND (valid_to IS NULL OR valid_to >= ?)
        AND (valid_from IS NULL OR valid_from <= ?)
      ORDER BY store_id, product_name`,
    [today, today]
  );
  return rows.map(rowToDeal);
}

export async function getDeal(id: number, db?: SQLiteDatabase): Promise<Deal | null> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<DealRow>(`${SELECT} WHERE id = ?`, [id]);
  return row ? rowToDeal(row) : null;
}

async function insertDeal(database: SQLiteDatabase, input: DealInput): Promise<number> {
  const result = await database.runAsync(
    `INSERT INTO deals
       (uuid, store_id, product_name, brand, price_cents, reference_price_cents, unit,
        quantity_text, valid_from, valid_to, source_url, scraped_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newUuid(),
      input.storeId,
      input.productName,
      input.brand,
      input.priceCents,
      input.referencePriceCents,
      input.unit,
      input.quantityText,
      input.validFrom,
      input.validTo,
      input.sourceUrl,
      input.scrapedAt,
    ]
  );
  return result.lastInsertRowId;
}

/**
 * A refresh replaces a store's cached deals wholesale: a scrape is the full
 * current offer set, so anything absent is no longer on offer. Old rows are
 * soft-deleted so a failed or partial scrape never destroys the cache either.
 */
export async function replaceStoreDeals(
  storeId: number,
  deals: readonly DealInput[],
  db?: SQLiteDatabase
): Promise<number> {
  const database = db ?? (await getDatabase());
  let inserted = 0;
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE deals
          SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE store_id = ? AND deleted = 0`,
      [storeId]
    );
    for (const deal of deals) {
      await insertDeal(database, deal);
      inserted += 1;
    }
  });
  return inserted;
}

export async function deleteDeal(id: number, db?: SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await database.runAsync(
    `UPDATE deals
        SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`,
    [id]
  );
}
