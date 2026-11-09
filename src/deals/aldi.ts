import type { Store } from '../models';
import { parseDecimal, toMinorUnits } from '../utils/currency';
import { stripTags } from './html';
import type { ParsedDeal } from './types';

const TEASER =
  /<p class="cms-multilayout-teaser__title">([\s\S]*?)<\/p>\s*<p class="cms-multilayout-teaser__description">([\s\S]*?)<\/p>/gi;
const BASE_PRICE = /\(([\d\s.,]+)\s*Ft\/(kg|db)\)/i;
const PACKAGE = /(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i;
const PIECES = /(\d+)\s*(?:db|darab)\b/i;

interface PackageAmount {
  quantity: number;
  unit: 'kg' | 'g' | 'db';
  text: string;
}

function packageAmount(title: string): PackageAmount | null {
  const weight = title.match(PACKAGE);
  if (weight) {
    const quantity = parseDecimal(weight[1] ?? '');
    if (quantity !== null) {
      return {
        quantity,
        unit: (weight[2] ?? '').toLowerCase() === 'kg' ? 'kg' : 'g',
        text: weight[0],
      };
    }
  }
  const pieces = title.match(PIECES);
  if (pieces) {
    const quantity = parseDecimal(pieces[1] ?? '');
    if (quantity !== null) {
      return { quantity, unit: 'db', text: pieces[0] };
    }
  }
  return null;
}

function totalPrice(title: string, basePrice: number, baseUnit: 'kg' | 'db'): number {
  const amount = packageAmount(title);
  if (baseUnit === 'db') {
    return amount?.unit === 'db' ? basePrice * amount.quantity : basePrice;
  }
  if (amount === null) {
    return basePrice;
  }
  if (amount.unit === 'kg') {
    return basePrice * amount.quantity;
  }
  if (amount.unit === 'g') {
    return (basePrice * amount.quantity) / 1000;
  }
  return basePrice;
}

/**
 * ALDI HU publishes promotion teasers without a total price. The description
 * carries the official base price per kg or piece, so the total is derived from
 * the package size in the title. No old price exists in the source.
 */
export function parseAldi(html: string, store: Store): ParsedDeal[] {
  const deals: ParsedDeal[] = [];
  for (const match of html.matchAll(TEASER)) {
    const productName = stripTags(match[1] ?? '');
    const description = stripTags(match[2] ?? '');
    if (productName === '' || !description.includes('Cikkszám')) {
      continue;
    }
    const base = description.match(BASE_PRICE);
    if (!base) {
      continue;
    }
    const basePrice = parseDecimal(base[1] ?? '');
    if (basePrice === null) {
      continue;
    }
    const baseUnit = (base[2] ?? '').toLowerCase() === 'db' ? 'db' : 'kg';
    const total = totalPrice(productName, basePrice, baseUnit);
    const amount = packageAmount(productName);

    deals.push({
      productName,
      brand: null,
      priceCents: toMinorUnits(total, store.currency),
      currency: store.currency,
      referencePriceCents: null,
      unit: baseUnit,
      quantityText: amount?.text ?? null,
      validFrom: null,
      validTo: null,
      rawText: `${productName} — ${description}`,
    });
  }
  return deals;
}

export const ALDI_PROVIDER = {
  storeId: 'aldi_hu',
  offersUrl: 'https://www.aldi.hu/szuper-akciok-mindennap',
  accept: 'text/html,application/xhtml+xml',
  parse: parseAldi,
} as const;
