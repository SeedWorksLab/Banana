import type { Store } from '../models';
import { parseDecimal, toMinorUnits } from '../utils/currency';
import { stripTags } from './html';
import type { ParsedDeal } from './types';

const ARTICLE = /<article\b[^>]*class\s*=\s*["'][^"']*\bproduct-tile\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gi;
const PRODUCT_NAME = /class\s*=\s*["'][^"']*\bproduct-name\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;
const PRODUCT_BRAND = /class\s*=\s*["'][^"']*\bproduct-brand\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;
const PRODUCT_UNIT = /class\s*=\s*["'][^"']*\bproduct-unit\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;
const SALES_VALUE =
  /class\s*=\s*["'][^"']*\bsales\b[^"']*["'][\s\S]*?class\s*=\s*["'][^"']*\bvalue\b[^"']*["'][^>]*content\s*=\s*["']([^"']+)["']/i;
const LIST_VALUE =
  /class\s*=\s*["'][^"']*\bstrike-through\b[^"']*["'][\s\S]*?class\s*=\s*["'][^"']*\bvalue\b[^"']*["'][^>]*content\s*=\s*["']([^"']+)["']/i;

function firstText(block: string, pattern: RegExp): string | null {
  const match = block.match(pattern);
  if (!match) {
    return null;
  }
  const text = stripTags(match[1] ?? '');
  return text === '' ? null : text;
}

function contentAmount(block: string, pattern: RegExp): number | null {
  const match = block.match(pattern);
  if (!match) {
    return null;
  }
  return parseDecimal(match[1] ?? '');
}

/**
 * Hofer's sale page uses product tiles with a canonical content attribute on
 * each price. Reading that attribute avoids the Austrian thousand/decimal
 * separator ambiguity in the visible text.
 */
export function parseHofer(html: string, store: Store): ParsedDeal[] {
  const deals: ParsedDeal[] = [];
  for (const block of html.match(ARTICLE) ?? []) {
    const productName = firstText(block, PRODUCT_NAME);
    const price = contentAmount(block, SALES_VALUE);
    if (productName === null || price === null) {
      continue;
    }
    const reference = contentAmount(block, LIST_VALUE);
    deals.push({
      productName,
      brand: firstText(block, PRODUCT_BRAND),
      priceCents: toMinorUnits(price, store.currency),
      currency: store.currency,
      referencePriceCents:
        reference !== null && reference > price
          ? toMinorUnits(reference, store.currency)
          : null,
      unit: firstText(block, PRODUCT_UNIT),
      quantityText: null,
      validFrom: null,
      validTo: null,
      rawText: stripTags(block),
    });
  }
  return deals;
}

export const HOFER_PROVIDER = {
  storeId: 'hofer',
  offersUrl: 'https://shop.hofer.at/sale',
  accept: 'text/html,application/xhtml+xml',
  parse: parseHofer,
} as const;
