export interface SeedWorksConfig {
  url: string;
  publishableKey: string;
}

// Public client identifiers, not account credentials; RLS protects every dataset.
export const SEEDWORKS_CLOUD: SeedWorksConfig = {
  url: 'https://qslmlcvskctvyngofipe.supabase.co',
  publishableKey: 'sb_publishable_lnbWUY3g4K8rRbekIKR97g_Q0IKxA8L',
};

export function seedWorksConfig(): SeedWorksConfig {
  const url = process.env.EXPO_PUBLIC_SEEDWORKS_URL?.trim() || SEEDWORKS_CLOUD.url;
  const publishableKey = process.env.EXPO_PUBLIC_SEEDWORKS_PUBLISHABLE_KEY?.trim() || SEEDWORKS_CLOUD.publishableKey;
  if (!url || !publishableKey || !/^https:\/\//.test(url)) {
    throw new Error('SeedWorks Cloud is not configured for this build.');
  }
  return { url, publishableKey };
}
