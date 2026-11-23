import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useCloudSync } from '../../src/sync/use-cloud-sync';

const originalState = AppState.currentState;
afterEach(() => { AppState.currentState = originalState; jest.useRealTimers(); jest.restoreAllMocks(); });

it('syncs foreground devices periodically, tolerates offline failures, and stops on unmount', async () => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
  const sync = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const { unmount } = await renderHook(() => useCloudSync(true, sync));
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(sync).toHaveBeenCalledTimes(2);
  await unmount();
  expect(remove).toHaveBeenCalled();
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(sync).toHaveBeenCalledTimes(2);
});

it('does not contact cloud when disabled', async () => {
  jest.useFakeTimers();
  const sync = jest.fn();
  await renderHook(() => useCloudSync(false, sync));
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(sync).not.toHaveBeenCalled();
});
