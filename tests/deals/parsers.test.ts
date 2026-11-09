import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Store } from '../../src/models';
import { parseAldi } from '../../src/deals/aldi';
import { loadBillaPages, parseBilla } from '../../src/deals/billa';
import { parseHofer } from '../../src/deals/hofer';
import { parseLidl } from '../../src/deals/lidl';
import { loadSparPages, parseSpar } from '../../src/deals/spar';
import type { PageFetcher } from '../../src/deals/types';

const fixtures = join(__dirname, '..', 'fixtures', 'deals');

function read(name: string): string {
  return readFileSync(join(fixtures, name), 'utf8');
}

function store(overrides: Partial<Store> = {}): Store {
  return {
    id: 1,
    uuid: null,
    storeId: 'lidl',
    name: 'Lidl',
    offersUrl: 'https://example.test/offers',
    country: 'AT',
    currency: 'EUR',
    enabled: true,
    lastScrapedAt: null,
    active: true,
    sortOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
    deleted: false,
    ...overrides,
  };
}

describe('parseLidl', () => {
  it('reads data-attribute offers and skips cards without a price', () => {
    const deals = parseLidl(read('lidl.html'), store());
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      productName: 'Naturgut Bio Bananen',
      brand: 'Naturgut',
      priceCents: 149,
      currency: 'EUR',
      referencePriceCents: 199,
      unit: '1 kg = 2.98',
      quantityText: '1 kg',
      validFrom: '2026-11-06',
      validTo: '2026-11-12',
    });
  });

  it('keeps Hungarian forint prices in whole forint', () => {
    const deals = parseLidl(
      read('lidl-hu.html'),
      store({ storeId: 'lidl_hu', name: 'Lidl HU', country: 'HU', currency: 'HUF' })
    );
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      productName: 'BELLAROM Szemes kávé',
      priceCents: 4599,
      currency: 'HUF',
      referencePriceCents: null,
      quantityText: '1 kg',
    });
  });
});

describe('parseHofer', () => {
  it('reads product tiles with canonical content prices', () => {
    const deals = parseHofer(read('hofer.html'), store({ storeId: 'hofer', name: 'Hofer' }));
    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({
      productName: 'Bankteil Rustic, grau',
      brand: 'Rustic',
      priceCents: 54900,
      currency: 'EUR',
      referencePriceCents: 59900,
      unit: 'per Stück',
      quantityText: null,
    });
    expect(deals[1]).toMatchObject({
      productName: 'Milch',
      brand: null,
      priceCents: 129,
      referencePriceCents: null,
      unit: 'per Liter',
    });
  });
});

describe('parseSpar', () => {
  it('reads search hits in major units with reference prices', () => {
    const deals = parseSpar(read('spar-page1.json'), store({ storeId: 'spar', name: 'Spar' }));
    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({
      productName: 'Bahlsen Leibniz Butterkeks weniger Zucker',
      brand: 'Bahlsen Leibniz',
      priceCents: 229,
      currency: 'EUR',
      referencePriceCents: 249,
      unit: 'kg',
      quantityText: '150 G',
    });
    expect(deals[1]).toMatchObject({
      productName: 'S-Budget Eier Freiland',
      priceCents: 349,
      referencePriceCents: null,
    });
  });

  it('loads every reported page exactly once', async () => {
    const calls: string[] = [];
    const fetchPage: PageFetcher = async (url) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        text: read(url.endsWith('page=2') ? 'spar-page2.json' : 'spar-page1.json'),
        error: null,
      };
    };

    const pages = await loadSparPages(store({ storeId: 'spar', name: 'Spar' }), fetchPage);
    expect(pages).toHaveLength(2);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('page=1');
    expect(calls[1]).toContain('page=2');
  });
});

describe('parseBilla', () => {
  it('reads promotion products with cent prices', () => {
    const deals = parseBilla(read('billa-page1.json'), store({ storeId: 'billa_at', name: 'Billa' }));
    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({
      productName: 'Glem Vital Shampoo',
      brand: 'Glem Vital',
      priceCents: 249,
      currency: 'EUR',
      referencePriceCents: 295,
      unit: 'ml',
      quantityText: '350 ml',
    });
    expect(deals[1]).toMatchObject({
      productName: 'Bio Milch',
      brand: null,
      priceCents: 129,
      referencePriceCents: null,
      quantityText: '1 l',
    });
  });

  it('loads pages by offset until total is reached', async () => {
    const calls: string[] = [];
    const fetchPage: PageFetcher = async (url) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        text: read(url.endsWith('offset=2') ? 'billa-page2.json' : 'billa-page1.json'),
        error: null,
      };
    };

    const pages = await loadBillaPages(
      store({ storeId: 'billa_at', name: 'Billa' }),
      fetchPage
    );
    expect(pages).toHaveLength(2);
    expect(calls[0]).toContain('offset=0');
    expect(calls[1]).toContain('offset=2');
  });
});

describe('parseAldi', () => {
  it('derives the package total from the official base price', () => {
    const deals = parseAldi(
      read('aldi.html'),
      store({ storeId: 'aldi_hu', name: 'Aldi HU', country: 'HU', currency: 'HUF' })
    );
    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({
      productName: 'PICK Erdbeeren, 600 g/tálca',
      brand: null,
      priceCents: 1699,
      currency: 'HUF',
      referencePriceCents: null,
      unit: 'kg',
      quantityText: '600 g',
    });
    expect(deals[1]).toMatchObject({
      productName: 'Banán, /kg',
      priceCents: 399,
      unit: 'kg',
      quantityText: null,
    });
  });
});
