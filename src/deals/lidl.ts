import { CURRENCIES } from '../models';
import type { Currency, Store, StoreId } from '../models';
import { toMinorUnits } from '../utils/currency';
import { decodeEntities, stripTags, toIsoDate } from './html';
import type { ParsedDeal } from './types';

const GRID_DATA = /data-grid-data\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

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

function asCurrency(value: unknown, fallback: Currency): Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value)
    ? (value as Currency)
    : fallback;
}

function offerPrice(regionsPrices: unknown): JsonObject | null {
  if (!isObject(regionsPrices)) {
    return null;
  }
  const preferred = regionsPrices['1'];
  if (isObject(preferred)) {
    return preferred;
  }
  const first = Object.values(regionsPrices).find(isObject);
  return first ?? null;
}

function brandName(value: unknown): string | null {
  return isObject(value) ? asString(value.name) : asString(value);
}

function makeLidlProvider(storeId: StoreId, offersUrl: string) {
  return {
    storeId,
    offersUrl,
    accept: 'text/html,application/xhtml+xml',
    parse: parseLidl,
  } as const;
}

/**
 * Lidl embeds each offer as a JSON object in a data-grid-data attribute. A
 * region's currentPrice is the shelf price; the Lidl Plus price is deliberately
 * ignored because it is conditional on a loyalty card.
 */
export function parseLidl(html: string, store: Store): ParsedDeal[] {
  const deals: ParsedDeal[] = [];
  for (const match of html.matchAll(GRID_DATA)) {
    const raw = decodeEntities(match[1] ?? match[2] ?? '');
    let product: JsonObject;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isObject(parsed)) {
        continue;
      }
      product = parsed;
    } catch {
      continue;
    }

    const region = offerPrice(product.regionsPrices);
    const current = isObject(region?.currentPrice) ? region.currentPrice : null;
    const price = asNumber(current?.price);
    if (price === null) {
      continue;
    }
    const productName =
      asString(product.fullTitle) ?? asString(product.title) ?? asString(product.description);
    if (productName === null) {
      continue;
    }

    const currency = asCurrency(current?.currencyCode, store.currency);
    const oldPrice = asNumber(current?.oldPrice);
    const discount = isObject(current?.discount) ? current.discount : null;
    const deletedPrice = asNumber(discount?.deletedPrice);
    const reference = oldPrice ?? deletedPrice;
    const basePrice = isObject(current?.basePrice) ? current.basePrice : null;
    const packaging = isObject(current?.packaging) ? current.packaging : null;

    deals.push({
      productName: stripTags(productName),
      brand: brandName(product.brand),
      priceCents: toMinorUnits(price, currency),
      currency,
      referencePriceCents:
        reference !== null && reference > price ? toMinorUnits(reference, currency) : null,
      unit: asString(basePrice?.text),
      quantityText: asString(packaging?.text),
      validFrom: toIsoDate(asString(current?.startDate)),
      validTo: toIsoDate(asString(current?.endDate ?? current?.endDateExclusive)),
      rawText: raw,
    });
  }
  return deals;
}

export const LIDL_PROVIDER = makeLidlProvider('lidl', 'https://www.lidl.at/');
export const LIDL_HU_PROVIDER = makeLidlProvider('lidl_hu', 'https://www.lidl.hu/');
