import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export function useCloudSync(
  enabled: boolean, sync: () => Promise<unknown>,
  subscribe?: (onChange: () => void) => Promise<() => void>,
  contextKey?: string | null
): void {
  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; }, [sync]);
  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let disposed = false;
    const run = async () => {
      if (disposed || running || AppState.currentState !== 'active') return;
      running = true;
      try {
        await syncRef.current();
      } catch {
        // Offline edits remain local; the next foreground sync retries them.
      } finally {
        running = false;
      }
    };
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    const timer = setInterval(() => { void run(); }, 15_000);
    let unsubscribe: (() => void) | undefined;
    if (subscribe) void subscribe(() => { void run(); }).then((cleanup) => {
      if (disposed) cleanup();
      else unsubscribe = cleanup;
    }).catch(() => {});
    return () => {
      disposed = true;
      clearInterval(timer);
      listener.remove();
      unsubscribe?.();
    };
  }, [enabled, subscribe, contextKey]);
}
