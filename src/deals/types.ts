import type { Currency, Store, StoreId } from '../models';

/**
 * One offer as a store published it, before it is given a database id or a
 * store id. Parsers are pure and never touch the network or the database.
 */
export interface ParsedDeal {
  productName: string;
  brand: string | null;
  priceCents: number;
  currency: Currency;
  referencePriceCents: number | null;
  unit: string | null;
  quantityText: string | null;
  validFrom: string | null;
  validTo: string | null;
  rawText: string;
}

export interface FetchedDealPage {
  url: string;
  body: string;
}

export interface FetchPageResult {
  ok: boolean;
  status: number;
  text: string;
  error: string | null;
}

export type PageFetcher = (url: string, accept: string) => Promise<FetchPageResult>;

export type StoreLoader = (store: Store, fetchPage: PageFetcher) => Promise<FetchedDealPage[]>;

export type StoreParser = (body: string, store: Store) => ParsedDeal[];

/**
 * A store's scraper. The endpoint lives with the parser so adding or moving a
 * store is one file, and the orchestrator only depends on this shape.
 */
export interface DealsProvider {
  storeId: StoreId;
  offersUrl: string;
  accept: string;
  parse: StoreParser;
  load?: StoreLoader;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface FetchInitLike {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type FetchLike = (url: string, init?: FetchInitLike) => Promise<FetchResponseLike>;
