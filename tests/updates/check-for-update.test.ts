import { checkForUpdate } from '../../src/updates/check-for-update';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
it('fails quietly when offline', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  expect(await checkForUpdate('0.2.0', null)).toBeNull();
});
it('bounds a stalled request even if fetch ignores abort', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));
  const result = checkForUpdate('0.2.0', null);
  await jest.advanceTimersByTimeAsync(15_000);
  expect(await result).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});
