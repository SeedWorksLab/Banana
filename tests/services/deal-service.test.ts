import {
  bestDealForIngredient,
  isDealActive,
  savingsCents,
  savingsPercent,
  type DealLike,
  type DealMatchLike,
} from '../../src/services/deal-service';

const TODAY = '2026-01-10';

function deal(partial: Partial<DealLike>): DealLike {
  return {
    id: partial.id ?? 1,
    storeId: partial.storeId ?? 1,
    productName: partial.productName ?? 'Product',
    brand: partial.brand ?? null,
    priceCents: partial.priceCents ?? 100,
    referencePriceCents: partial.referencePriceCents === undefined ? null : partial.referencePriceCents,
    validFrom: partial.validFrom === undefined ? null : partial.validFrom,
    validTo: partial.validTo === undefined ? null : partial.validTo,
    scrapedAt: partial.scrapedAt ?? '2026-01-10T08:00:00.000Z',
  };
}

function match(partial: Partial<DealMatchLike>): DealMatchLike {
  return {
    dealId: partial.dealId ?? 1,
    ingredientId: partial.ingredientId ?? 1,
    confidence: partial.confidence ?? 1,
    status: partial.status ?? 'auto',
  };
}

describe('isDealActive', () => {
  it('accepts a deal inside its validity window', () => {
    expect(isDealActive(deal({ validFrom: '2026-01-01', validTo: '2026-01-20' }), '2026-01-10')).toBe(true);
  });

  it('rejects an expired or future deal', () => {
    expect(isDealActive(deal({ validTo: '2026-01-05' }), '2026-01-10')).toBe(false);
    expect(isDealActive(deal({ validFrom: '2026-01-15' }), '2026-01-10')).toBe(false);
  });

  it('treats a missing window as open-ended', () => {
    expect(isDealActive(deal({}), '2026-01-10')).toBe(true);
  });
});

describe('savingsCents', () => {
  it('is the reference minus the price', () => {
    expect(savingsCents(deal({ priceCents: 350, referencePriceCents: 500 }))).toBe(150);
  });

  it('is zero without a reference or without a discount', () => {
    expect(savingsCents(deal({ priceCents: 350, referencePriceCents: null }))).toBe(0);
    expect(savingsCents(deal({ priceCents: 500, referencePriceCents: 450 }))).toBe(0);
  });
});

describe('savingsPercent', () => {
  it('computes a rounded percentage', () => {
    expect(savingsPercent(deal({ priceCents: 350, referencePriceCents: 500 }))).toBe(30);
  });

  it('is null when there is no saving to show', () => {
    expect(savingsPercent(deal({ priceCents: 350, referencePriceCents: null }))).toBeNull();
  });
});

describe('bestDealForIngredient', () => {
  it('picks the cheapest active, accepted deal', () => {
    const best = bestDealForIngredient(
      7,
      [
        deal({ id: 1, storeId: 1, priceCents: 349, referencePriceCents: 449 }),
        deal({ id: 2, storeId: 2, priceCents: 299, referencePriceCents: 449 }),
      ],
      [match({ dealId: 1, ingredientId: 7 }), match({ dealId: 2, ingredientId: 7 })],
      '2026-01-10'
    );
    expect(resultSummary(best)).toEqual({ id: 2, storeId: 2, savingsCents: 150 });
  });

  it('ignores rejected and inactive matches', () => {
    const result = bestDealForIngredient(
      7,
      [
        deal({ id: 1, priceCents: 100 }),
        deal({ id: 2, priceCents: 200, validTo: '2026-01-01' }),
      ],
      [match({ dealId: 1, ingredientId: 7, status: 'rejected' }), match({ dealId: 2, ingredientId: 7 })],
      '2026-01-10'
    );
    expect(result).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(bestDealForIngredient(7, [deal({})], [], '2026-01-10')).toBeNull();
  });

  it('breaks a price tie by the larger saving', () => {
    const best = bestDealForIngredient(
      7,
      [deal({ id: 1, priceCents: 200, referencePriceCents: 250 }), deal({ id: 2, priceCents: 200, referencePriceCents: 400 })],
      [match({ dealId: 1, ingredientId: 7 }), match({ dealId: 2, ingredientId: 7 })],
      '2026-01-10'
    );
    expect(best?.deal.id).toBe(2);
  });

  it('breaks a remaining tie by store id for stability', () => {
    const best = bestDealForIngredient(
      7,
      [deal({ id: 5, storeId: 3, priceCents: 200 }), deal({ id: 6, storeId: 1, priceCents: 200 })],
      [match({ dealId: 5, ingredientId: 7 }), match({ dealId: 6, ingredientId: 7 })],
      '2026-01-10'
    );
    expect(best?.deal.id).toBe(6);
  });
});

function resultSummary(result: { deal: { id: number; storeId: number }; savingsCents: number } | null) {
  if (result === null) {
    return null;
  }
  return { id: result.deal.id, storeId: result.deal.storeId, savingsCents: result.savingsCents };
}
