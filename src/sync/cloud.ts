export interface SeedWorksConfig {
  url: string;
  publishableKey: string;
}

export function seedWorksConfig(): SeedWorksConfig {
  const url = process.env.EXPO_PUBLIC_SEEDWORKS_URL?.trim();
  const publishableKey = process.env.EXPO_PUBLIC_SEEDWORKS_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey || !/^https:\/\//.test(url)) {
    throw new Error('SeedWorks Cloud is not configured for this build.');
  }
  return { url, publishableKey };
}
