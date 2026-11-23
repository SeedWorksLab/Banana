import { planBatchCooking } from '../../src/services/batch-cooking-service';

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
