import type { StoreId } from '../models';
import { ALDI_PROVIDER } from './aldi';
import { BILLA_PROVIDER } from './billa';
import { HOFER_PROVIDER } from './hofer';
import { LIDL_HU_PROVIDER, LIDL_PROVIDER } from './lidl';
import { SPAR_PROVIDER } from './spar';
import type { DealsProvider } from './types';

const PROVIDERS: Partial<Record<StoreId, DealsProvider>> = {
  lidl: LIDL_PROVIDER,
  lidl_hu: LIDL_HU_PROVIDER,
  hofer: HOFER_PROVIDER,
  billa_at: BILLA_PROVIDER,
  spar: SPAR_PROVIDER,
  aldi_hu: ALDI_PROVIDER,
};

export function providerFor(storeId: StoreId): DealsProvider | null {
  return PROVIDERS[storeId] ?? null;
}

export function isStoreSupported(storeId: StoreId): boolean {
  return providerFor(storeId) !== null;
}
