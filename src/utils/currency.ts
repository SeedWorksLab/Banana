export const CURRENCY_CODE = 'EUR';
export const CURRENCY_SYMBOL = '€';

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}${CURRENCY_SYMBOL}${euros},${String(remainder).padStart(2, '0')}`;
}

export function formatCentsCompact(cents: number): string {
  if (cents % 100 === 0) {
    return `${cents < 0 ? '-' : ''}${CURRENCY_SYMBOL}${Math.abs(Math.round(cents)) / 100}`;
  }
  return formatCents(cents);
}

export function parseAmountToCents(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{0,2})?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100);
}

export function savingsPercent(referenceCents: number, dealCents: number): number | null {
  if (referenceCents <= 0 || dealCents >= referenceCents) {
    return null;
  }
  return Math.round(((referenceCents - dealCents) / referenceCents) * 100);
}
