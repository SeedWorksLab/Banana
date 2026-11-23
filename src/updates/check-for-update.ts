import { GITHUB_API_LATEST_RELEASE_URL } from '../config/repository';
import { availableUpdate, type AppUpdate } from './update-policy';

export async function checkForUpdate(current: string, ignored: string | null): Promise<AppUpdate | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Update check timed out'));
      controller.abort();
    }, 15_000);
  });
  try {
    const response = await Promise.race([deadline, fetch(GITHUB_API_LATEST_RELEASE_URL, {
      signal: controller.signal, headers: { Accept: 'application/vnd.github+json' },
    })]);
    if (!response.ok) return null;
    return availableUpdate(await Promise.race([deadline, response.json()]), current, ignored);
  } catch { return null; }
  finally { clearTimeout(timer); }
}
