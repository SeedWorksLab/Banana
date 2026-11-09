import { isPathAllowed, openStoreFetcher } from '../../src/deals/fetcher';
import type { FetchLike, FetchResponseLike } from '../../src/deals/types';

function response(body: string, status = 200): FetchResponseLike {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

describe('isPathAllowed', () => {
  it('allows a path when no rule matches', () => {
    expect(isPathAllowed('User-agent: *\nDisallow: /checkout', '/aktionen')).toBe(true);
  });

  it('disallows a matching path', () => {
    expect(isPathAllowed('User-agent: *\nDisallow: /aktionen', '/aktionen/a1')).toBe(false);
  });

  it('lets a longer allow override a shorter disallow', () => {
    const robots = 'User-agent: *\nDisallow: /aktionen\nAllow: /aktionen/offers';
    expect(isPathAllowed(robots, '/aktionen/offers')).toBe(true);
    expect(isPathAllowed(robots, '/aktionen/secret')).toBe(false);
  });
});

describe('openStoreFetcher', () => {
  it('checks robots.txt once, then fetches the requested page', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fake: FetchLike = async (url, init) => {
      calls.push({ url, headers: init?.headers ?? {} });
      if (url.endsWith('/robots.txt')) {
        return response('User-agent: *\nDisallow: /checkout');
      }
      return response('<html>offers</html>');
    };

    const opened = await openStoreFetcher('https://shop.test/aktionen', { fetchImpl: fake });
    expect(opened.ok).toBe(true);
    expect(opened.fetchPage).not.toBeNull();

    const page = await opened.fetchPage?.('https://shop.test/aktionen', 'text/html');
    expect(page).toMatchObject({ ok: true, text: '<html>offers</html>', error: null });
    expect(calls.map((call) => call.url)).toEqual([
      'https://shop.test/robots.txt',
      'https://shop.test/aktionen',
    ]);
    expect(calls[1].headers['User-Agent']).toContain('Banana');
    expect(calls[1].headers.Accept).toBe('text/html');
  });

  it('gives up without fetching the page when robots disallows it', async () => {
    const calls: string[] = [];
    const fake: FetchLike = async (url) => {
      calls.push(url);
      return response('User-agent: *\nDisallow: /aktionen');
    };

    const opened = await openStoreFetcher('https://shop.test/aktionen', { fetchImpl: fake });
    expect(opened.ok).toBe(false);
    expect(opened.fetchPage).toBeNull();
    expect(opened.error).toBe('Disallowed by robots.txt');
    expect(calls).toEqual(['https://shop.test/robots.txt']);
  });

  it('continues when robots.txt itself cannot be reached', async () => {
    const calls: string[] = [];
    const fake: FetchLike = async (url) => {
      calls.push(url);
      if (url.endsWith('/robots.txt')) {
        throw new TypeError('network down');
      }
      return response('{"results":[]}');
    };

    const opened = await openStoreFetcher('https://shop.test/offers', { fetchImpl: fake });
    const page = await opened.fetchPage?.('https://shop.test/offers', 'application/json');
    expect(page).toMatchObject({ ok: true, text: '{"results":[]}' });
    expect(calls).toEqual(['https://shop.test/robots.txt', 'https://shop.test/offers']);
  });

  it('refuses a page request that leaves the store origin', async () => {
    const calls: string[] = [];
    const fake: FetchLike = async (url) => {
      calls.push(url);
      return response('User-agent: *');
    };

    const opened = await openStoreFetcher('https://shop.test/aktionen', { fetchImpl: fake });
    const page = await opened.fetchPage?.('https://other.test/aktionen', 'text/html');
    expect(page).toMatchObject({
      ok: false,
      error: 'The store page moved off its own site',
    });
    expect(calls).toEqual(['https://shop.test/robots.txt']);
  });

  it('reports a page network failure without throwing', async () => {
    const fake: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt')) {
        return response('User-agent: *');
      }
      throw new TypeError('network down');
    };

    const opened = await openStoreFetcher('https://shop.test/aktionen', { fetchImpl: fake });
    const page = await opened.fetchPage?.('https://shop.test/aktionen', 'text/html');
    expect(page).toMatchObject({ ok: false, error: 'Could not reach the store' });
  });
});
