import { getClient } from './supabase';
import { getSyncMeta } from '../database/syncMeta';

export async function subscribeToDataChanges(onChange: () => void): Promise<() => void> {
  const identity = await getSyncMeta('active_data_context');
  if (!identity) return () => {};
  const client = getClient();
  const channel = client.channel(`banana-data-${identity}`)
    .on('postgres_changes', { event: '*', schema: 'banana', filter: `user_id=eq.${identity}` }, onChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}
