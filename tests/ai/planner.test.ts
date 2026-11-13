import {
  AiParseError,
  extractJsonObject,
  parseNewspaperResponse,
  parsePlanEditResponse,
  parseRecipeExtractionResponse,
  type PlanEditContext,
} from '../../src/ai/planner';

const context: PlanEditContext = {
  today: '2026-11-10',
  weekStart: '2026-11-09',
  weeklyBudgetCents: 5000,
  homes: [{ id: 1, name: 'Home' }],
  days: [],
  slots: [],
  recipes: [],
  pantry: [],
  deals: [],
  allergies: [],
  diet: null,
  dislikes: [],
  avoidIngredients: [],
};

describe('extractJsonObject', () => {
  it('accepts plain JSON and fenced JSON', () => {
    expect(extractJsonObject('{"message":"ok"}')).toEqual({ message: 'ok' });
    expect(extractJsonObject('```json\n{"message":"ok"}\n```')).toEqual({ message: 'ok' });
  });

  it('repairs a trailing comma', () => {
    expect(extractJsonObject('{"message":"ok",}')).toEqual({ message: 'ok' });
  });

  it('rejects a reply with no object', () => {
    expect(() => extractJsonObject('I updated your plan.')).toThrow(AiParseError);
  });
});

describe('parsePlanEditResponse', () => {
  it('normalizes a valid plan edit and ignores unknown actions', () => {
    const result = parsePlanEditResponse(
      JSON.stringify({
        message: 'Moved chilli to Thursday.',
        actions: [
          { type: 'set_slot', day: 'Thu', mealType: 'dinner', recipeName: 'Chilli', servings: '2' },
          { type: 'not_a_real_action', day: 'fri' },
          { type: 'replan' },
        ],
      })
    );
    expect(result.message).toBe('Moved chilli to Thursday.');
    expect(result.actions).toEqual([
      {
        type: 'set_slot',
        day: 'thu',
        mealType: 'dinner',
        recipeId: null,
        recipeName: 'Chilli',
        freeText: null,
        servings: 2,
      },
      { type: 'replan', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
    ]);
  });

  it('keeps a create_recipe payload and its schedule', () => {
    const result = parsePlanEditResponse(
      JSON.stringify({
        message: 'Added a recipe.',
        actions: [
          {
            type: 'create_recipe',
            scheduleDay: 'sun',
            recipe: {
              name: 'Pancakes',
              servings: 3,
              ingredients: [{ name: 'Flour', quantity: 250, unit: 'g' }],
              steps: ['Mix', 'Fry'],
            },
          },
        ],
      })
    );
    const action = result.actions[0];
    expect(action.type).toBe('create_recipe');
    if (action.type === 'create_recipe') {
      expect(action.scheduleDay).toBe('sun');
      expect(action.recipe.name).toBe('Pancakes');
      expect(action.recipe.ingredients[0]).toEqual({
        name: 'Flour',
        quantity: 250,
        unit: 'g',
        category: 'other',
        shelfLifeDays: null,
        optional: false,
      });
    }
  });
});

describe('parseRecipeExtractionResponse', () => {
  it('accepts either a recipes array or a single recipe', () => {
    const batch = parseRecipeExtractionResponse(
      JSON.stringify({
        message: 'Two recipes.',
        recipes: [
          { name: 'Soup', ingredients: [{ name: 'Onion', quantity: 1, unit: 'piece' }] },
          { name: 'Salad', ingredients: [{ name: 'Lettuce', quantity: 1, unit: 'piece' }] },
        ],
      })
    );
    expect(batch.recipes.map((recipe) => recipe.name)).toEqual(['Soup', 'Salad']);

    const single = parseRecipeExtractionResponse(
      JSON.stringify({ message: 'One recipe.', recipe: { name: 'Toast' } })
    );
    expect(single.recipes).toHaveLength(1);
    expect(single.recipes[0].name).toBe('Toast');
  });
});

describe('parseNewspaperResponse', () => {
  it('converts major-unit prices to cents and keeps only real offers', () => {
    const result = parseNewspaperResponse(
      JSON.stringify({
        message: 'Saved the leaflet.',
        deals: [
          {
            store: 'Lidl',
            product: 'Milk 3.5%',
            price: '1,29',
            wasPrice: 1.59,
            validTo: '2026-11-16',
          },
          { store: 'Spar', product: 'No price' },
        ],
        shoppingItems: [{ name: 'Kitchen roll', saleOnly: true }],
      })
    );
    expect(result.deals).toHaveLength(1);
    expect(result.deals[0]).toMatchObject({
      storeName: 'Lidl',
      productName: 'Milk 3.5%',
      priceCents: 129,
      referencePriceCents: 159,
      validTo: '2026-11-16',
    });
    expect(result.shoppingItems[0]).toMatchObject({ label: 'Kitchen roll', saleOnly: true });
  });
});

describe('plan edit context', () => {
  it('is serialized as a single JSON object', () => {
    expect(JSON.parse(JSON.stringify(context))).toMatchObject({ today: '2026-11-10' });
  });
});
