import type { Store } from '../models';
import { parseDecimal, toMinorUnits } from '../utils/currency';
import type { FetchedDealPage, PageFetcher, ParsedDeal } from './types';

export const SPAR_API_URL = 'https://api-scp.spar-ics.com/ecom/pw/v1/search/v1/search';
export const SPAR_HITS_PER_PAGE = 32;

interface JsonObject {
  [key: string]: unknown;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return typeof value === 'string' ? parseDecimal(value) : null;
}

function nested(value: unknown, key: string): unknown {
  return isObject(value) ? value[key] : undefined;
}

function sparPageUrl(page: number): string {
  return `${SPAR_API_URL}?query=*&marketId=8999&filter=inAngebot:true&sort=Relevancy:asc&hitsPerPage=${SPAR_HITS_PER_PAGE}&showPermutedSearchParams=false&page=${page}`;
}

export async function loadSparPages(
  _store: Store,
  fetchPage: PageFetcher
): Promise<FetchedDealPage[]> {
  const pages: FetchedDealPage[] = [];
  let page = 1;
  let pageCount = 1;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const url = sparPageUrl(page);
    const result = await fetchPage(url, 'application/json');
    if (!result.ok) {
      throw new Error(result.error ?? 'The Spar offers page could not be read');
    }
    pages.push({ url, body: result.text });

    let payload: unknown;
    try {
      payload = JSON.parse(result.text);
    } catch {
      throw new Error('The Spar offers page was not valid JSON');
    }
    const reportedPageCount = asNumber(nested(nested(payload, 'paging'), 'pageCount'));
    if (reportedPageCount !== null) {
      pageCount = reportedPageCount;
    }
    if (page >= pageCount) {
      break;
    }
    page += 1;
  }

  return pages;
}

/**
 * Spar's search API returns current offers when filtered with `inAngebot`.
 * Prices are major units and must be converted with the store's currency
 * exponent, unlike Billa's cent amounts.
 */
export function parseSpar(body: string, store: Store): ParsedDeal[] {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return [];
  }
  const hits = nested(payload, 'hits');
  if (!Array.isArray(hits)) {
    return [];
  }

  const deals: ParsedDeal[] = [];
  for (const hit of hits) {
    if (!isObject(hit)) {
      continue;
    }
    const master = nested(hit, 'masterValues');
    const name1 = asString(nested(master, 'name1'));
    const name2 = asString(nested(master, 'name2'));
    const name3 = asString(nested(master, 'name3'));
    const productName = [name1, name2].filter((part): part is string => part !== null).join(' ');
    if (productName === '') {
      continue;
    }

    const geoInformation = nested(master, 'geoInformation');
    const firstGeo = Array.isArray(geoInformation) ? geoInformation[0] : null;
    const geoValues = nested(firstGeo, 'geoValues');
    const price = asNumber(nested(geoValues, 'calculatedPrice'));
    if (price === null) {
      continue;
    }
    const reference = asNumber(nested(geoValues, 'stattPrice'));

    deals.push({
      productName,
      brand: name1,
      priceCents: toMinorUnits(price, store.currency),
      currency: store.currency,
      referencePriceCents:
        reference !== null && reference > price
          ? toMinorUnits(reference, store.currency)
          : null,
      unit: asString(nested(geoValues, 'comparisonPrice_unit')),
      quantityText: name3,
      validFrom: null,
      validTo: null,
      rawText: JSON.stringify(hit),
    });
  }
  return deals;
}

export const SPAR_PROVIDER = {
  storeId: 'spar',
  offersUrl: SPAR_API_URL,
  accept: 'application/json',
  load: loadSparPages,
  parse: parseSpar,
} as const;
