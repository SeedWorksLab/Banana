import {
  currencyExponent,
  currencySymbol,
  formatCents,
  formatCentsCompact,
  fromMinorUnits,
  parseAmountToCents,
  parseDecimal,
  toMinorUnits,
} from '../../src/utils/currency';

describe('currency metadata', () => {
  it('uses two decimals for euro and none for forint', () => {
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencyExponent('EUR')).toBe(2);
    expect(currencySymbol('HUF')).toBe('Ft');
    expect(currencyExponent('HUF')).toBe(0);
  });
});

describe('minor units', () => {
  it('converts euro amounts to cents', () => {
    expect(toMinorUnits(12.99, 'EUR')).toBe(1299);
    expect(fromMinorUnits(1299, 'EUR')).toBe(12.99);
  });

  it('keeps forint amounts whole', () => {
    expect(toMinorUnits(4599.4, 'HUF')).toBe(4599);
    expect(fromMinorUnits(4599, 'HUF')).toBe(4599);
  });
});

describe('formatCents', () => {
  it('formats euro with grouping and decimals', () => {
    expect(formatCents(123456, 'EUR')).toBe('€1 234,56');
    expect(formatCents(-99, 'EUR')).toBe('-€0,99');
  });

  it('formats forint without decimals', () => {
    expect(formatCents(123456, 'HUF')).toBe('123 456 Ft');
  });
});

describe('formatCentsCompact', () => {
  it('omits zero decimals per currency', () => {
    expect(formatCentsCompact(100, 'EUR')).toBe('€1');
    expect(formatCentsCompact(149, 'EUR')).toBe('€1,49');
    expect(formatCentsCompact(4599, 'HUF')).toBe('4 599 Ft');
  });
});

describe('decimal parsing', () => {
  it('reads Austrian and Hungarian formatted amounts', () => {
    expect(parseDecimal('1.234,56 €')).toBe(1234.56);
    expect(parseDecimal('2 831,67 Ft/kg')).toBe(2831.67);
    expect(parseDecimal('1,49')).toBe(1.49);
    expect(parseDecimal('399 Ft')).toBe(399);
  });

  it('returns null for text without a number', () => {
    expect(parseDecimal('kein Preis')).toBeNull();
  });

  it('applies the currency exponent', () => {
    expect(parseAmountToCents('1.234,56 €', 'EUR')).toBe(123456);
    expect(parseAmountToCents('4 599 Ft', 'HUF')).toBe(4599);
  });
});
