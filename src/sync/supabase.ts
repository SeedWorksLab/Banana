import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { authStorage } from '../database/syncMeta';
import { seedWorksConfig } from './cloud';

export type BananaClient = SupabaseClient<any, any, 'banana'>;

let client: BananaClient | null = null;

export function getClient(): BananaClient {
  if (client) return client;
  const config = seedWorksConfig();
  const created: BananaClient = createClient(config.url, config.publishableKey, {
    db: { schema: 'banana' },
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  client = created;
  return created;
}

export async function signInToSeedWorks(email: string, password: string): Promise<User> {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Could not sign in.');
  }
  return data.user;
}

export async function getSignedInUser(): Promise<User | null> {
  const { data: { session } } = await getClient().auth.getSession();
  return session?.user ?? null;
}

export async function signOutOfSeedWorks(): Promise<void> {
  const { error } = await getClient().auth.signOut();
  if (error) throw new Error(error.message);
}
