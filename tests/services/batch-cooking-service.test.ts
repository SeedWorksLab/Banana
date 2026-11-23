import { assertBatchHomeChange, batchCookServings, batchMealDetails, leftoverSources, planBatchCooking, planLeftoverLink } from '../../src/services/batch-cooking-service';
import { batchBudget, batchSlot } from '../fixtures/batch-meals';

describe('planBatchCooking', () => {
  it('cooks two portions Tuesday and reserves one for Wednesday', () => {
    expect(planBatchCooking('tue', 2, 1)).toEqual({
      sourceDay: 'tue', leftoverDays: ['wed'], cookServings: 2, mealServings: 1,
    });
  });
  it('supports a household across several meals', () => {
    expect(planBatchCooking('fri', 3, 2).cookServings).toBe(6);
    expect(planBatchCooking('sun', 1, 2).leftoverDays).toEqual([]);
  });
  it.each([[0, 1], [2.5, 1], [7, 1], [2, 0], [2, 1.5]])(
    'rejects invalid days/servings %s/%s', (days, servings) => {
      expect(() => planBatchCooking('tue', days, servings)).toThrow();
    }
  );
});

describe('explicit leftover links', () => {
  const source = batchSlot();
  const target = { day: 'wed' as const, mealType: 'lunch' as const, homeId: 1 };
  const reservation = batchSlot({
    id: 2, uuid: 'meal-2', day: 'wed', mealType: 'lunch', kind: 'leftovers', batchSourceUuid: source.uuid,
  });

  it('separates portions eaten now from all reserved portions', () => {
    const cooking = { ...source, servings: 5 };
    const later = { ...reservation, id: 3, uuid: 'meal-3', day: 'fri' as const, servings: 1 };
    const slots = [cooking, later, reservation];
    expect(batchMealDetails(cooking, slots)).toMatchObject({ cookServings: 5, mealServings: 2, leftovers: [reservation, later] });
    expect(batchMealDetails(reservation, slots)).toMatchObject({ source: cooking, mealServings: 2, cookServings: 5 });
    expect(batchMealDetails({ ...reservation, batchSourceUuid: 'missing' }, slots).source).toBeNull();
    expect(batchMealDetails(batchSlot(), [batchSlot()]).mealServings).toBe(2);
  });

  it('finds earlier cooking meals, including another meal type and the same day', () => {
    const breakfast = batchSlot({ id: 4, uuid: 'breakfast', day: 'wed', mealType: 'breakfast' });
    const future = batchSlot({ id: 5, uuid: 'future', day: 'thu' });
    const same = batchSlot({ id: 6, uuid: 'same', day: 'wed', mealType: 'lunch' });
    expect(leftoverSources([source, breakfast, future, same, reservation], [], target, 1))
      .toEqual([breakfast, source]);
  });

  it('excludes other homes, restaurants, deleted meals, cooked batches and leftovers as sources', () => {
    expect(leftoverSources([source], [batchBudget({ homeId: 2 })], target, 1)).toEqual([]);
    expect(leftoverSources([source], [batchBudget({ mealSettings: [
      { mealType: 'dinner', mode: 'eating_out', enabled: true, cookMinutes: 0 },
    ] })], target, 1)).toEqual([]);
    for (const candidate of [
      { ...source, deleted: true }, { ...source, uuid: null },
      { ...source, cookedAt: '2026-11-24T18:00:00.000Z' },
      { ...source, kind: 'leftovers' as const }, { ...source, recipeId: null },
    ]) expect(leftoverSources([candidate], [], target, 1)).toEqual([]);
    expect(leftoverSources([source, { ...reservation, cookedAt: '2026-11-25T12:00:00.000Z' }], [], target, 1)).toEqual([]);
  });

  it('adds and resizes a reservation without repeatedly inflating the source', () => {
    expect(planLeftoverLink([source], [], target, source.uuid!, 2, 1).sourceServings).toBe(4);
    const slots = [{ ...source, servings: 4 }, reservation];
    expect(planLeftoverLink(slots, [], target, source.uuid!, 2, 1).sourceServings).toBe(4);
    expect(planLeftoverLink(slots, [], target, source.uuid!, 1, 1).sourceServings).toBe(3);
    expect(planLeftoverLink(slots, [], target, source.uuid!, 3, 1).sourceServings).toBe(5);
  });

  it('returns both source adjustments when changing which meal supplies leftovers', () => {
    const other = batchSlot({ id: 4, uuid: 'other', day: 'mon', servings: 3 });
    const change = planLeftoverLink([{ ...source, servings: 4 }, reservation, other], [], target, 'other', 1, 1);
    expect(change).toMatchObject({ sourceServings: 4, previousSourceServings: 2, previousSource: { uuid: source.uuid } });
  });

  it('rejects missing sources, invalid portions, eaten meals and replacing a cooking source', () => {
    expect(() => planLeftoverLink([source], [], target, 'missing', 1, 1)).toThrow('earlier');
    for (const servings of [0, -1, 1.5, NaN]) {
      expect(() => planLeftoverLink([source], [], target, source.uuid!, servings, 1)).toThrow('portion');
      expect(() => batchCookServings(servings, [])).toThrow('portion');
    }
    expect(() => planLeftoverLink([source, { ...reservation, cookedAt: '2026-11-25T12:00:00.000Z' }],
      [], target, source.uuid!, 2, 1)).toThrow('already cooked or eaten');
    expect(() => planLeftoverLink([source, reservation, batchSlot({ uuid: 'other', id: 8, day: 'mon' })],
      [], { ...source, homeId: 1 }, 'other', 2, 1)).toThrow('supplies other leftovers');
    const old = { ...source, cookedAt: '2026-11-24T18:00:00.000Z' };
    expect(() => planLeftoverLink([old, reservation, batchSlot({ uuid: 'other', id: 8, day: 'mon' })],
      [], target, 'other', 2, 1)).toThrow('original batch');
  });

  it('keeps linked meals in the same home, including after a day-home edit', () => {
    expect(() => assertBatchHomeChange([source, reservation], [], 'wed', 1, 1)).not.toThrow();
    expect(() => assertBatchHomeChange([source, reservation], [], 'wed', 2, 1)).toThrow('same home');
    expect(() => assertBatchHomeChange([source, reservation], [], 'tue', 2, 1)).toThrow('same home');
    expect(batchCookServings(2, [{ servings: 1 }, { servings: 3 }])).toBe(6);
    expect(() => batchCookServings(2, [{ servings: -1 }])).toThrow('portion');
  });
});
