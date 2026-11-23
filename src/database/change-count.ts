import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from './database';

export async function getChangeCount(db?: SQLiteDatabase): Promise<number> {
  const database = db ?? (await getDatabase());
  const row = await database.getFirstAsync<{ total: number }>('SELECT total_changes() AS total');
  return row?.total ?? 0;
}
