import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

interface CheckIdentity {
  week_id: number;
  home_id: number | null;
  ingredient_id: number;
  unit: string;
  week_uuid: string;
  home_uuid: string | null;
  ingredient_uuid: string;
}

async function identity(
  weekId: number, homeId: number | null, ingredientId: number, unit: string,
  db: SQLiteDatabase
): Promise<CheckIdentity> {
  const week = await db.getFirstAsync<{ uuid: string }>('SELECT uuid FROM weeks WHERE id = ?', [weekId]);
  const home = homeId === null ? null : await db.getFirstAsync<{ uuid: string }>(
    'SELECT uuid FROM homes WHERE id = ?', [homeId]
  );
  const ingredient = await db.getFirstAsync<{ uuid: string }>(
    'SELECT uuid FROM ingredients WHERE id = ?', [ingredientId]
  );
  if (!week?.uuid || !ingredient?.uuid || (homeId !== null && !home?.uuid)) {
    throw new Error('Cannot save a shopping check without its week, home and ingredient');
  }
  return {
    week_id: weekId, home_id: homeId, ingredient_id: ingredientId, unit,
    week_uuid: week.uuid, home_uuid: home?.uuid ?? null, ingredient_uuid: ingredient.uuid,
  };
}

export async function shoppingCheckKey(
  weekId: number, homeId: number | null, ingredientId: number, unit: string,
  db?: SQLiteDatabase
): Promise<string> {
  const database = db ?? (await getDatabase());
  const row = await identity(weekId, homeId, ingredientId, unit, database);
  return JSON.stringify([row.week_uuid, row.home_uuid, row.ingredient_uuid, row.unit]);
}

export async function saveShoppingCheck(
  weekId: number, homeId: number | null, ingredientId: number, unit: string,
  checked: boolean, db?: SQLiteDatabase
): Promise<void> {
  const database = db ?? (await getDatabase());
  const row = await identity(weekId, homeId, ingredientId, unit, database);
  const key = JSON.stringify([row.week_uuid, row.home_uuid, row.ingredient_uuid, row.unit]);
  await database.runAsync(
    `INSERT INTO shopping_checks (week_id, home_id, ingredient_id, unit, item_key, checked)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (item_key) DO UPDATE SET checked = excluded.checked`,
    [weekId, homeId, ingredientId, unit, key, checked ? 1 : 0]
  );
}

export async function getShoppingChecks(
  weekId: number, db?: SQLiteDatabase
): Promise<Map<string, boolean>> {
  const database = db ?? (await getDatabase());
  const rows = await database.getAllAsync<{ item_key: string; checked: number }>(
    'SELECT item_key, checked FROM shopping_checks WHERE week_id = ?', [weekId]
  );
  return new Map(rows.map((row) => [row.item_key, row.checked === 1]));
}
