import { compareStableVersions } from './release-notes';
import { GITHUB_REPO_URL } from '../config/repository';

export interface AppUpdate {
  version: string;
  url: string;
  apkUrl: string;
}

export function availableUpdate(payload: unknown, current: string, ignored: string | null): AppUpdate | null {
  if (!payload || typeof payload !== 'object') return null;
  const item = payload as Record<string, unknown>;
  if (item.draft === true || item.prerelease === true || typeof item.tag_name !== 'string') return null;
  const version = item.tag_name.replace(/^v/, '');
  try {
    if (compareStableVersions(version, current) <= 0 ||
      (ignored !== null && compareStableVersions(version, ignored) === 0)) return null;
  } catch { return null; }
  const url = `${GITHUB_REPO_URL}/releases/tag/${item.tag_name}`;
  if (item.html_url !== url || !Array.isArray(item.assets)) return null;
  const prefix = `${GITHUB_REPO_URL}/releases/download/${item.tag_name}/`;
  for (const asset of item.assets) {
    if (!asset || typeof asset !== 'object') continue;
    const entry = asset as Record<string, unknown>;
    if (typeof entry.name !== 'string' || !/^[a-zA-Z0-9._-]+\.apk$/i.test(entry.name)) continue;
    if (entry.browser_download_url === prefix + entry.name) {
      return { version, url, apkUrl: entry.browser_download_url };
    }
  }
  return null;
}
