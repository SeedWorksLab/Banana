import type { BananaClient } from './supabase';
import { Platform } from 'react-native';

export interface RemoteRow {
  uuid: string;
  user_id: string;
  payload: Record<string, unknown>;
  updated_at: string;
}

export interface RemoteSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface RemoteTombstone {
  table_name: string;
  row_key: string;
  deleted_at: string;
}

export interface SeedProfile {
  display_name: string | null;
  updated_at: string;
}

export interface SyncTransport {
  listRows(table: string, userId: string): Promise<RemoteRow[]>;
  upsertRow(table: string, row: RemoteRow): Promise<void>;
  deleteRow(table: string, uuid: string, userId: string): Promise<void>;
  listSettings(userId: string): Promise<RemoteSetting[]>;
  upsertSetting(userId: string, setting: RemoteSetting): Promise<void>;
  listTombstones(userId: string): Promise<RemoteTombstone[]>;
  upsertTombstone(userId: string, tombstone: RemoteTombstone): Promise<void>;
  deleteTombstone(userId: string, table: string, uuid: string): Promise<void>;
  getProfile(userId: string): Promise<SeedProfile | null>;
  setProfile(userId: string, name: string | null): Promise<void>;
  reportUsage(records: number, bytes: number): Promise<void>;
}

const PAGE_SIZE = 500;

function check(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export function createSupabaseTransport(client: BananaClient): SyncTransport {
  return {
    async listRows(table, userId) {
      const rows: RemoteRow[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await client.from(table).select('uuid,user_id,payload,updated_at')
          .eq('user_id', userId).order('uuid').range(offset, offset + PAGE_SIZE - 1);
        check(error, `Could not read ${table}`);
        rows.push(...(data ?? []) as RemoteRow[]);
        if ((data ?? []).length < PAGE_SIZE) return rows;
      }
    },
    async upsertRow(table, row) {
      const { error } = await client.from(table).upsert(row, { onConflict: 'user_id,uuid' });
      check(error, `Could not save ${table}`);
    },
    async deleteRow(table, uuid, userId) {
      const { error } = await client.from(table).delete().eq('user_id', userId).eq('uuid', uuid);
      check(error, `Could not delete ${table}`);
    },
    async listSettings(userId) {
      const { data, error } = await client.from('settings').select('key,value,updated_at')
        .eq('user_id', userId);
      check(error, 'Could not load settings');
      return (data ?? []) as RemoteSetting[];
    },
    async upsertSetting(userId, setting) {
      const { error } = await client.from('settings').upsert(
        { user_id: userId, ...setting }, { onConflict: 'user_id,key' }
      );
      check(error, 'Could not save settings');
    },
    async listTombstones(userId) {
      const rows: RemoteTombstone[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await client.from('sync_tombstones')
          .select('table_name,row_key,deleted_at').eq('user_id', userId)
          .order('table_name').order('row_key').range(offset, offset + PAGE_SIZE - 1);
        check(error, 'Could not load deletions');
        rows.push(...(data ?? []) as RemoteTombstone[]);
        if ((data ?? []).length < PAGE_SIZE) return rows;
      }
    },
    async upsertTombstone(userId, tombstone) {
      const { error } = await client.from('sync_tombstones').upsert(
        { user_id: userId, ...tombstone }, { onConflict: 'user_id,table_name,row_key' }
      );
      check(error, 'Could not save deletion');
    },
    async deleteTombstone(userId, table, uuid) {
      const { error } = await client.from('sync_tombstones').delete()
        .eq('user_id', userId).eq('table_name', table).eq('row_key', uuid);
      check(error, 'Could not resolve deletion');
    },
    async getProfile(userId) {
      const { data, error } = await client.schema('public').from('seed_profiles')
        .select('display_name,updated_at').eq('id', userId).maybeSingle();
      check(error, 'Could not read SeedWorks profile');
      return data as SeedProfile | null;
    },
    async setProfile(userId, name) {
      const { error } = await client.schema('public').from('seed_profiles')
        .update({ display_name: name }).eq('id', userId);
      check(error, 'Could not save SeedWorks username');
    },
    async reportUsage(records, bytes) {
      const { error } = await client.schema('public').rpc('seed_report_app_usage', {
        p_app_slug: 'banana',
        p_record_count: records,
        p_byte_count: bytes,
        p_device_name: `Banana (${Platform.OS})`,
      });
      check(error, 'Could not report SeedWorks usage');
    },
  };
}
