import type { Store } from '../models';
import type { FetchedDealPage, PageFetcher, ParsedDeal } from './types';

export const BILLA_API_URL = 'https://shop.billa.at/api/product-discovery/products';
export const BILLA_PAGE_SIZE = 500;

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
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nested(value: unknown, key: string): unknown {
  return isObject(value) ? value[key] : undefined;
}

export async function loadBillaPages(
  _store: Store,
  fetchPage: PageFetcher
): Promise<FetchedDealPage[]> {
  const pages: FetchedDealPage[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  for (let page = 0; page < 20; page += 1) {
    const url = `${BILLA_API_URL}?pageSize=${BILLA_PAGE_SIZE}&inPromotion=true&offset=${offset}`;
    const result = await fetchPage(url, 'application/json');
    if (!result.ok) {
      throw new Error(result.error ?? 'The Billa offers page could not be read');
    }
    pages.push({ url, body: result.text });

    let payload: unknown;
    try {
      payload = JSON.parse(result.text);
    } catch {
      throw new Error('The Billa offers page was not valid JSON');
    }
    const results = nested(payload, 'results');
    const count = Array.isArray(results) ? results.length : 0;
    const reportedTotal = asNumber(nested(payload, 'total'));
    if (reportedTotal !== null) {
      total = reportedTotal;
    }
    offset += count;
    if (count === 0 || offset >= total) {
      break;
    }
  }

  return pages;
}

/**
 * Billa's product discovery API returns promotion products with prices already
 * in integer cents. `regular.value` is the current shelf price; `crossed` is
 * the pre-promotion reference.
 */
export function parseBilla(body: string, store: Store): ParsedDeal[] {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return [];
  }
  const results = nested(payload, 'results');
  if (!Array.isArray(results)) {
    return [];
  }

  const deals: ParsedDeal[] = [];
  for (const result of results) {
    if (!isObject(result)) {
      continue;
    }
    const productName = asString(result.name);
    const price = nested(result.price, 'regular');
    const priceCents = asNumber(nested(price, 'value'));
    if (productName === null || priceCents === null) {
      continue;
    }

    const crossed = asNumber(nested(result.price, 'crossed'));
    const standard = asNumber(nested(nested(result.price, 'standard'), 'value'));
    const reference = crossed ?? standard;
    const amount = asString(result.amount);
    const volume = asString(result.volumeLabelShort);
    const packageLabel = asString(result.packageLabel);

    deals.push({
      productName,
      brand: asString(nested(result.brand, 'name')),
      priceCents,
      currency: store.currency,
      referencePriceCents:
        reference !== null && reference > priceCents ? reference : null,
      unit: asString(nested(result.price, 'baseUnitShort')),
      quantityText: [amount, volume ?? packageLabel].filter((part) => part !== null).join(' ') || null,
      validFrom: null,
      validTo: null,
      rawText: JSON.stringify(result),
    });
  }
  return deals;
}

export const BILLA_PROVIDER = {
  storeId: 'billa_at',
  offersUrl: BILLA_API_URL,
  accept: 'application/json',
  load: loadBillaPages,
  parse: parseBilla,
} as const;
