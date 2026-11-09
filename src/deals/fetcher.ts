import type { FetchLike, FetchPageResult, PageFetcher } from './types';

export const SCRAPE_USER_AGENT =
  'Banana/0.1 (private local-first meal planner; +https://github.com/henrikkerezsi/Banana)';

const TIMEOUT_MS = 12_000;

export interface OpenStoreFetcherResult {
  ok: boolean;
  status: number;
  fetchPage: PageFetcher | null;
  error: string | null;
}

interface RawResponse {
  ok: boolean;
  status: number;
  text: string;
  error: string | null;
}

function defaultFetch(): FetchLike {
  return globalThis.fetch as unknown as FetchLike;
}

async function getText(
  fetchImpl: FetchLike,
  url: string,
  accept: string,
  acceptLanguage: string
): Promise<RawResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': SCRAPE_USER_AGENT,
        Accept: accept,
        'Accept-Language': acceptLanguage,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (caught) {
    const name = caught instanceof Error ? caught.name : '';
    return {
      ok: false,
      status: 0,
      text: '',
      error: name === 'AbortError' ? 'The store did not answer in time' : 'Could not reach the store',
    };
  } finally {
    clearTimeout(timer);
  }
}

interface RobotsGroup {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

function parseRobots(robots: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasRule = false;

  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (line === '') {
      continue;
    }
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'user-agent') {
      if (current === null || lastWasRule) {
        current = { agents: [], rules: [] };
        groups.push(current);
        lastWasRule = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if ((key === 'allow' || key === 'disallow') && current !== null) {
      current.rules.push({ allow: key === 'allow', path: value });
      lastWasRule = true;
    }
  }
  return groups;
}

function pathMatches(pattern: string, path: string): boolean {
  if (pattern === '') {
    return false;
  }
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`).test(path);
}

/**
 * Applies the robots.txt rules for our user agent (falling back to `*`). The
 * longest matching rule wins, which is the convention search engines use.
 */
export function isPathAllowed(robots: string, path: string): boolean {
  const groups = parseRobots(robots);
  const rules = groups
    .filter((group) => group.agents.includes('*') || group.agents.includes('banana'))
    .flatMap((group) => group.rules);

  let winner: { allow: boolean; length: number } | null = null;
  for (const rule of rules) {
    if (pathMatches(rule.path, path)) {
      const length = rule.path.length;
      if (winner === null || length > winner.length) {
        winner = { allow: rule.allow, length };
      }
    }
  }
  return winner === null ? true : winner.allow;
}

/**
 * The only function in Banana that fetches a retailer. It reads robots.txt for
 * the source path once, then exposes a page fetcher for the one store refresh.
 * A provider may request sequential pages from the same retailer. It never
 * authenticates, submits a form, retries in a loop, or sends personal data.
 */
export async function openStoreFetcher(
  offersUrl: string,
  options: { fetchImpl?: FetchLike; acceptLanguage?: string } = {}
): Promise<OpenStoreFetcherResult> {
  let parsed: URL;
  try {
    parsed = new URL(offersUrl);
  } catch {
    return { ok: false, status: 0, fetchPage: null, error: 'The store URL is not valid' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, status: 0, fetchPage: null, error: 'The store URL must be http(s)' };
  }

  const fetchImpl = options.fetchImpl ?? defaultFetch();
  const acceptLanguage = options.acceptLanguage ?? 'de-AT,de;q=0.9,en;q=0.8';
  const path = parsed.pathname === '' ? '/' : parsed.pathname;

  const robots = await getText(
    fetchImpl,
    `${parsed.origin}/robots.txt`,
    'text/plain',
    acceptLanguage
  );
  // A missing robots.txt means "no restrictions"; a robots failure must not
  // block the offers page, because a failed scrape has to stay inert rather
  // than disabling the feature.
  if (robots.ok && !isPathAllowed(robots.text, path)) {
    return {
      ok: false,
      status: 0,
      fetchPage: null,
      error: 'Disallowed by robots.txt',
    };
  }

  const fetchPage: PageFetcher = async (url, accept): Promise<FetchPageResult> => {
    let requested: URL;
    try {
      requested = new URL(url);
    } catch {
      return { ok: false, status: 0, text: '', error: 'The store URL is not valid' };
    }
    if (requested.origin !== parsed.origin) {
      return {
        ok: false,
        status: 0,
        text: '',
        error: 'The store page moved off its own site',
      };
    }
    return getText(fetchImpl, requested.toString(), accept, acceptLanguage);
  };

  return { ok: true, status: 200, fetchPage, error: null };
}
