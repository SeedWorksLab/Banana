import type { Currency, MatchStatus } from '../models';
import { savingsPercent as percentOf } from '../utils/currency';

export interface DealLike {
  id: number;
  storeId: number;
  productName: string;
  brand: string | null;
  priceCents: number;
  currency?: Currency;
  referencePriceCents: number | null;
  validFrom: string | null;
  validTo: string | null;
  scrapedAt: string;
}

export interface DealMatchLike {
  dealId: number;
  ingredientId: number;
  confidence: number;
  status: MatchStatus;
}

export interface IngredientDeal {
  deal: DealLike;
  confidence: number;
  savingsCents: number;
}

export function isDealActive(deal: DealLike, today: string): boolean {
  if (deal.validFrom !== null && deal.validFrom > today) {
    return false;
  }
  if (deal.validTo !== null && deal.validTo < today) {
    return false;
  }
  return true;
}

export function savingsCents(deal: DealLike): number {
  if (deal.referencePriceCents === null) {
    return 0;
  }
  return Math.max(0, deal.referencePriceCents - deal.priceCents);
}

export function savingsPercent(deal: DealLike): number | null {
  if (deal.referencePriceCents === null) {
    return null;
  }
  return percentOf(deal.referencePriceCents, deal.priceCents);
}

/**
 * The best current offer for one ingredient. Only active, non-rejected matches
 * are considered; the cheapest effective price wins, ties are broken by the
 * larger saving and then by a stable store id so results never flicker.
 */
export function bestDealForIngredient(
  ingredientId: number,
  deals: readonly DealLike[],
  matches: readonly DealMatchLike[],
  today: string,
  currency?: Currency
): IngredientDeal | null {
  const byId = new Map(deals.map((deal) => [deal.id, deal]));
  const candidates: IngredientDeal[] = [];
  for (const match of matches) {
    if (match.ingredientId !== ingredientId || match.status === 'rejected') {
      continue;
    }
    const deal = byId.get(match.dealId);
    if (!deal || !isDealActive(deal, today)) {
      continue;
    }
    if (currency !== undefined && (deal.currency ?? 'EUR') !== currency) {
      continue;
    }
    candidates.push({ deal, confidence: match.confidence, savingsCents: savingsCents(deal) });
  }
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => {
    if (a.deal.priceCents !== b.deal.priceCents) {
      return a.deal.priceCents - b.deal.priceCents;
    }
    if (a.savingsCents !== b.savingsCents) {
      return b.savingsCents - a.savingsCents;
    }
    if (a.deal.storeId !== b.deal.storeId) {
      return a.deal.storeId - b.deal.storeId;
    }
    return a.deal.id - b.deal.id;
  });
  return candidates[0];
}

export function bestDealByIngredient(
  ingredientIds: readonly number[],
  deals: readonly DealLike[],
  matches: readonly DealMatchLike[],
  today: string,
  currency?: Currency
): Map<number, IngredientDeal> {
  const result = new Map<number, IngredientDeal>();
  for (const ingredientId of ingredientIds) {
    const best = bestDealForIngredient(ingredientId, deals, matches, today, currency);
    if (best) {
      result.set(ingredientId, best);
    }
  }
  return result;
}

export function totalSavingsCents(best: readonly IngredientDeal[]): number {
  return best.reduce((sum, entry) => sum + entry.savingsCents, 0);
}
