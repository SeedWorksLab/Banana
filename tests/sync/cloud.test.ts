import { seedWorksConfig, SEEDWORKS_CLOUD } from '../../src/sync/cloud';

const previous = { url: process.env.EXPO_PUBLIC_SEEDWORKS_URL, key: process.env.EXPO_PUBLIC_SEEDWORKS_PUBLISHABLE_KEY };
afterEach(() => {
  if (previous.url === undefined) delete process.env.EXPO_PUBLIC_SEEDWORKS_URL;
  else process.env.EXPO_PUBLIC_SEEDWORKS_URL = previous.url;
  if (previous.key === undefined) delete process.env.EXPO_PUBLIC_SEEDWORKS_PUBLISHABLE_KEY;
  else process.env.EXPO_PUBLIC_SEEDWORKS_PUBLISHABLE_KEY = previous.key;
});

it('ships with public SeedWorks connection settings even without build variables', () => {
  delete process.env.EXPO_PUBLIC_SEEDWORKS_URL;
  delete process.env.EXPO_PUBLIC_SEEDWORKS_PUBLISHABLE_KEY;
  expect(seedWorksConfig()).toEqual(SEEDWORKS_CLOUD);
  expect(seedWorksConfig().publishableKey).toMatch(/^sb_publishable_/);
});

it('permits HTTPS deployment overrides but rejects insecure endpoints', () => {
  process.env.EXPO_PUBLIC_SEEDWORKS_URL = 'http://invalid.example.test';
  expect(() => seedWorksConfig()).toThrow();
  process.env.EXPO_PUBLIC_SEEDWORKS_URL = 'https://cloud.example.test';
  expect(seedWorksConfig().url).toBe('https://cloud.example.test');
});
