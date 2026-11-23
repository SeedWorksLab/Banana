import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS } from '../../src/database/migrations';
import { switchDataContext } from '../../src/database/data-contexts';
import { getChangeCount } from '../../src/database/change-count';

it('isolates households, restores personal edits, and never snapshots auth credentials', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    execAsync: async (sql: string) => { sqlite.exec(sql); },
    runAsync: async (sql: string, params: (string | number | null)[] = []) => {
      const result = sqlite.prepare(sql).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getFirstAsync: async (sql: string, params: (string | number | null)[] = []) => sqlite.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: (string | number | null)[] = []) => sqlite.prepare(sql).all(...params),
    withTransactionAsync: async (fn: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try { await fn(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as SQLiteDatabase;
  try {
    for (const migration of MIGRATIONS) {
      if (migration.sql) await db.execAsync(migration.sql);
      await migration.apply?.(db, 0);
    }
    const before = await getChangeCount(db);
    sqlite.exec(`
      INSERT INTO recipes (name, category) VALUES ('Personal soup', 'dinner');
      INSERT INTO sync_meta (key, value) VALUES ('auth_session_test', 'private-token');
      INSERT INTO settings (key, value) VALUES ('ignored_update_version', '0.3.0');
    `);
    expect(await getChangeCount(db)).toBeGreaterThan(before);
    await switchDataContext('household', 'personal', db);
    expect(sqlite.prepare('SELECT uuid FROM preferences WHERE id = 1').get())
      .toMatchObject({ uuid: expect.any(String) });
    expect(sqlite.prepare("SELECT value FROM settings WHERE key = 'ignored_update_version'").get())
      .toMatchObject({ value: '0.3.0' });
    expect(sqlite.prepare('SELECT name FROM recipes').all()).toEqual([]);
    sqlite.exec("INSERT INTO recipes (name, category) VALUES ('Shared curry', 'dinner')");
    await switchDataContext('personal', 'personal', db);
    expect(sqlite.prepare('SELECT name FROM recipes').all()).toEqual([{ name: 'Personal soup' }]);
    await switchDataContext('household', 'personal', db);
    expect(sqlite.prepare('SELECT name FROM recipes').all()).toEqual([{ name: 'Shared curry' }]);
    const snapshots = sqlite.prepare('SELECT payload FROM data_contexts').all();
    expect(JSON.stringify(snapshots)).not.toContain('private-token');
    expect(sqlite.prepare("SELECT value FROM sync_meta WHERE key = 'auth_session_test'").get())
      .toMatchObject({ value: 'private-token' });
  } finally { sqlite.close(); }
});
