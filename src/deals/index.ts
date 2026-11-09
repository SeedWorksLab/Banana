import type { SQLiteDatabase } from 'expo-sqlite';
import type { ScrapeRunStatus, Store, StoreId } from '../models';
import { getDatabase } from '../database/database';
import { getEnabledStores, getStoreByStoreId, markStoreScraped } from '../database/stores';
import { getDealsByStore, replaceStoreDeals } from '../database/deals';
import { ensureDealMatch } from '../database/dealMatches';
import { createScrapeRun } from '../database/scrapeRuns';
import { getAllIngredients } from '../database/ingredients';
import { getAllIngredientAliases } from '../database/ingredientAliases';
import { openStoreFetcher } from './fetcher';
import { matchIngredients, type MatcherIngredient } from './matcher';
import { providerFor } from './providers';
import type { FetchLike } from './types';
import { isoNow } from '../utils/date';

export { providerFor } from './providers';
export const STALE_AFTER_HOURS = 12;

export interface DealRefreshStoreResult {
  storeId: StoreId;
  status: ScrapeRunStatus;
  dealsFound: number;
  dealsNew: number;
  error: string | null;
}

export interface DealRefreshOptions {
  storeIds?: readonly StoreId[];
  fetchImpl?: FetchLike;
  db?: SQLiteDatabase;
}

export function isStoreStale(
  store: Pick<Store, 'lastScrapedAt'>,
  now: Date,
  staleAfterHours = STALE_AFTER_HOURS
): boolean {
  if (store.lastScrapedAt === null) {
    return true;
  }
  const last = Date.parse(store.lastScrapedAt);
  if (Number.isNaN(last)) {
    return true;
  }
  return now.getTime() - last >= staleAfterHours * 60 * 60 * 1000;
}

async function loadMatcherIngredients(db: SQLiteDatabase): Promise<MatcherIngredient[]> {
  const [ingredients, aliases] = await Promise.all([
    getAllIngredients(db),
    getAllIngredientAliases(db),
  ]);
  const aliasesByIngredient = new Map<number, string[]>();
  for (const alias of aliases) {
    const list = aliasesByIngredient.get(alias.ingredientId);
    if (list) {
      list.push(alias.alias);
    } else {
      aliasesByIngredient.set(alias.ingredientId, [alias.alias]);
    }
  }
  return ingredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.name,
    aliases: aliasesByIngredient.get(ingredient.id) ?? [],
  }));
}

/**
 * Refreshes the cached offers of the requested stores (all enabled stores by
 * default). Every attempt is audited in scrape_runs. A failure is inert: it
 * neither throws nor wipes the previous snapshot. The app keeps rendering the
 * last good cache and the next refresh tries again.
 */
export async function refreshDeals(
  options: DealRefreshOptions = {}
): Promise<DealRefreshStoreResult[]> {
  const db = options.db ?? (await getDatabase());
  const now = isoNow();

  const enabled = await getEnabledStores(db);
  const wanted = options.storeIds;
  const stores =
    wanted === undefined
      ? enabled
      : (await Promise.all(wanted.map((storeId) => getStoreByStoreId(storeId, db)))).filter(
          (store): store is Store => store !== null
        );

  if (stores.length === 0) {
    return [];
  }

  const matcherIngredients = await loadMatcherIngredients(db);
  const results: DealRefreshStoreResult[] = [];

  for (const store of stores) {
    const provider = providerFor(store.storeId);
    const startedAt = isoNow();

    if (provider === null) {
      const error = 'Offers are not available for this store yet';
      await createScrapeRun(
        {
          storeId: store.id,
          status: 'failed',
          dealsFound: 0,
          dealsNew: 0,
          error,
          startedAt,
          finishedAt: isoNow(),
        },
        db
      );
      results.push({
        storeId: store.storeId,
        status: 'failed',
        dealsFound: 0,
        dealsNew: 0,
        error,
      });
      continue;
    }

    const opened = await openStoreFetcher(provider.offersUrl, {
      fetchImpl: options.fetchImpl,
      acceptLanguage:
        store.country === 'HU' ? 'hu-HU,hu;q=0.9,en;q=0.8' : 'de-AT,de;q=0.9,en;q=0.8',
    });
    if (!opened.ok || opened.fetchPage === null) {
      const error = opened.error ?? 'The store page could not be read';
      await createScrapeRun(
        {
          storeId: store.id,
          status: 'failed',
          dealsFound: 0,
          dealsNew: 0,
          error,
          startedAt,
          finishedAt: isoNow(),
        },
        db
      );
      results.push({
        storeId: store.storeId,
        status: 'failed',
        dealsFound: 0,
        dealsNew: 0,
        error,
      });
      continue;
    }

    let parsed;
    try {
      const pages = provider.load
        ? await provider.load(store, opened.fetchPage)
        : [
            await opened.fetchPage(provider.offersUrl, provider.accept).then((page) => {
              if (!page.ok) {
                throw new Error(page.error ?? 'The store page could not be read');
              }
              return { url: provider.offersUrl, body: page.text };
            }),
          ];
      parsed = pages.flatMap((page) => provider.parse(page.body, store));
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : 'The store page could not be parsed';
      await createScrapeRun(
        {
          storeId: store.id,
          status: 'partial',
          dealsFound: 0,
          dealsNew: 0,
          error,
          startedAt,
          finishedAt: isoNow(),
        },
        db
      );
      results.push({
        storeId: store.storeId,
        status: 'partial',
        dealsFound: 0,
        dealsNew: 0,
        error,
      });
      continue;
    }

    if (parsed.length === 0) {
      // A page that fetches but yields nothing is usually a markup change, not
      // "no offers". Keep the previous cache and flag the run.
      const error = 'No offers were recognised on the store page';
      await createScrapeRun(
        {
          storeId: store.id,
          status: 'partial',
          dealsFound: 0,
          dealsNew: 0,
          error,
          startedAt,
          finishedAt: isoNow(),
        },
        db
      );
      results.push({
        storeId: store.storeId,
        status: 'partial',
        dealsFound: 0,
        dealsNew: 0,
        error,
      });
      continue;
    }

    const inserted = await replaceStoreDeals(
      store.id,
      parsed.map((deal) => ({
        storeId: store.id,
        productName: deal.productName,
        brand: deal.brand,
        priceCents: deal.priceCents,
        currency: deal.currency,
        referencePriceCents: deal.referencePriceCents,
        unit: deal.unit,
        quantityText: deal.quantityText,
        validFrom: deal.validFrom,
        validTo: deal.validTo,
        sourceUrl: provider.offersUrl,
        scrapedAt: now,
        rawText: deal.rawText,
      })),
      db
    );

    const stored = await getDealsByStore(store.id, db);
    for (const deal of stored) {
      const matches = matchIngredients(deal.productName, matcherIngredients);
      for (const match of matches) {
        await ensureDealMatch(
          { dealId: deal.id, ingredientId: match.ingredientId, confidence: match.confidence },
          db
        );
      }
    }

    await markStoreScraped(store.id, now, db);
    await createScrapeRun(
      {
        storeId: store.id,
        status: 'succeeded',
        dealsFound: parsed.length,
        dealsNew: inserted,
        error: null,
        startedAt,
        finishedAt: isoNow(),
      },
      db
    );
    results.push({
      storeId: store.storeId,
      status: 'succeeded',
      dealsFound: parsed.length,
      dealsNew: inserted,
      error: null,
    });
  }

  return results;
}
