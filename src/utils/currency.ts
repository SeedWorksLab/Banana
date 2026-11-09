import type { Currency } from '../models';

export const DEFAULT_CURRENCY: Currency = 'EUR';

export const CURRENCY_LABELS: Record<Currency, string> = {
  EUR: 'Euro (€)',
  HUF: 'Forint (Ft)',
};

const CURRENCY_META: Record<Currency, { symbol: string; exponent: number }> = {
  EUR: { symbol: '€', exponent: 2 },
  HUF: { symbol: 'Ft', exponent: 0 },
};

export function currencySymbol(currency: Currency = DEFAULT_CURRENCY): string {
  return CURRENCY_META[currency].symbol;
}

export function currencyExponent(currency: Currency = DEFAULT_CURRENCY): number {
  return CURRENCY_META[currency].exponent;
}

export function toMinorUnits(amount: number, currency: Currency = DEFAULT_CURRENCY): number {
  return Math.round(amount * 10 ** currencyExponent(currency));
}

export function fromMinorUnits(cents: number, currency: Currency = DEFAULT_CURRENCY): number {
  return Math.round(cents) / 10 ** currencyExponent(currency);
}

function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatCents(cents: number, currency: Currency = DEFAULT_CURRENCY): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(cents));
  const divisor = 10 ** currencyExponent(currency);
  const whole = Math.floor(absolute / divisor);
  const remainder = absolute % divisor;
  const symbol = currencySymbol(currency);
  if (currency === 'HUF') {
    return `${sign}${groupThousands(whole)} ${symbol}`;
  }
  return `${sign}${symbol}${groupThousands(whole)},${String(remainder).padStart(2, '0')}`;
}

export function formatCentsCompact(cents: number, currency: Currency = DEFAULT_CURRENCY): string {
  const divisor = 10 ** currencyExponent(currency);
  if (cents % divisor === 0) {
    const sign = cents < 0 ? '-' : '';
    const whole = groupThousands(Math.abs(Math.round(cents)) / divisor);
    return currency === 'HUF'
      ? `${sign}${whole} ${currencySymbol(currency)}`
      : `${sign}${currencySymbol(currency)}${whole}`;
  }
  return formatCents(cents, currency);
}

export function parseDecimal(value: string): number | null {
  let normalized = value.trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(',', '.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAmountToCents(
  text: string,
  currency: Currency = DEFAULT_CURRENCY
): number | null {
  const amount = parseDecimal(text);
  return amount === null ? null : toMinorUnits(amount, currency);
}

export function savingsPercent(referenceCents: number, dealCents: number): number | null {
  if (referenceCents <= 0 || dealCents >= referenceCents) {
    return null;
  }
  return Math.round(((referenceCents - dealCents) / referenceCents) * 100);
}
