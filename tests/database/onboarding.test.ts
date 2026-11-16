import type { SQLiteDatabase } from 'expo-sqlite';
import { getWelcomeSeen, setWelcomeSeen } from '../../src/database/onboarding';
import { MIGRATIONS } from '../../src/database/migrations';

describe('first launch', () => {
  const adoption = MIGRATIONS.find((migration) => migration.id === 8);

  it('keeps new installs on the welcome screen', async () => {
    const runAsync = jest.fn().mockResolvedValue(undefined);
    const db = { runAsync } as unknown as SQLiteDatabase;
    await adoption?.apply?.(db, 0);
    expect(runAsync).not.toHaveBeenCalled();
  });

  it('adopts existing local databases without showing them a first-use prompt', async () => {
    const runAsync = jest.fn().mockResolvedValue(undefined);
    const db = { runAsync } as unknown as SQLiteDatabase;
    await adoption?.apply?.(db, 7);
    expect(runAsync).toHaveBeenCalledWith(expect.stringContaining("'welcome_seen'"));
    expect(runAsync).toHaveBeenCalledWith(expect.stringContaining("'tutorial_seen'"));
  });

  it('persists the choice independently of language and tutorial progress', async () => {
    const runAsync = jest.fn().mockResolvedValue(undefined);
    const getFirstAsync = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ value: '1' });
    const db = { runAsync, getFirstAsync } as unknown as SQLiteDatabase;
    expect(await getWelcomeSeen(db)).toBe(false);
    await setWelcomeSeen(db);
    expect(await getWelcomeSeen(db)).toBe(true);
    expect(runAsync).toHaveBeenCalledWith(expect.stringContaining("'welcome_seen'"));
  });
});
