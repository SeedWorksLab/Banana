import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { backupDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../database/database';
import { BACKUP_EXTENSION } from './date';
import { toFilePath } from './paths';

export const BACKUP_MIME_TYPE = 'application/x-sqlite3';

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Writes the whole database to a staging copy with the AI credentials removed.
 *
 * The backup is produced through SQLite's online backup API so the WAL is folded
 * into a complete, openable file. Credentials are stripped because a backup is a
 * file the user sends to themselves, and AGENTS.md §9.2 forbids an API key ever
 * leaving the device; the base URL, model and enabled flag are kept, so a restore
 * only needs the key again.
 */
export async function createBackupFile(): Promise<File> {
  const db = await getDatabase();
  const name = `banana-backup-${timestampSlug()}.${BACKUP_EXTENSION}`;
  const file = new File(Paths.cache, name);
  if (file.exists) {
    file.delete();
  }
  let staging: SQLiteDatabase | null = null;
  try {
    staging = await openDatabaseAsync(name, {}, toFilePath(Paths.cache.uri));
    await backupDatabaseAsync({ sourceDatabase: db, destDatabase: staging });
    await staging.runAsync('UPDATE ai_state SET llm_api_key = NULL WHERE id = 1');
    await staging.execAsync('VACUUM');
  } finally {
    await staging?.closeAsync();
  }
  return file;
}

export async function shareBackup(): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) {
    return false;
  }
  const file = await createBackupFile();
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: BACKUP_MIME_TYPE,
      dialogTitle: 'Banana backup',
    });
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
  return true;
}

/**
 * Replaces the app's database with the picked backup. The picked file is staged
 * in the app cache first, so the restore never depends on expo-file-system having
 * write access to the database directory. This is destructive by design.
 */
export async function restoreFromBackup(fileUri: string): Promise<void> {
  const source = new File(fileUri);
  const bytes = await source.bytes();

  const tempName = `banana-restore-${Date.now()}.${BACKUP_EXTENSION}`;
  const tempFile = new File(Paths.cache, tempName);
  if (tempFile.exists) {
    tempFile.delete();
  }
  tempFile.create({ intermediates: true, overwrite: true });
  tempFile.write(bytes);

  let staging: SQLiteDatabase | null = null;
  try {
    staging = await openDatabaseAsync(tempName, {}, toFilePath(Paths.cache.uri));
    const db = await getDatabase();
    await backupDatabaseAsync({ sourceDatabase: staging, destDatabase: db });
  } finally {
    await staging?.closeAsync();
    if (tempFile.exists) {
      tempFile.delete();
    }
  }
}

export async function pickBackupFile(): Promise<File | null> {
  const result = await File.pickFileAsync({
    mimeTypes: [BACKUP_MIME_TYPE, 'application/octet-stream'],
  });
  if (result.canceled) {
    return null;
  }
  return result.result;
}
