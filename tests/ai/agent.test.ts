import {
  planEditUserMessage,
  runNewspaperExtraction,
  runPlanEdit,
  runRecipeExtraction,
} from '../../src/ai/agent';
import type { PlanEditContext } from '../../src/ai/planner';
import type { AiCompletion, AiCompletionRequest, AiProvider } from '../../src/ai/provider';
import multiMealFixture from './fixtures/multi-meal-recipes.json';

function fakeProvider(text: string): { provider: AiProvider; calls: AiCompletionRequest[] } {
  const calls: AiCompletionRequest[] = [];
  const provider: AiProvider = {
    async complete(request): Promise<AiCompletion> {
      calls.push(request);
      return {
        text,
        model: 'test-model',
        inputTokens: 120,
        outputTokens: 45,
      };
    },
  };
  return { provider, calls };
}

const context: PlanEditContext = {
  today: '2026-11-10',
  weekStart: '2026-11-09',
  weeklyBudgetCents: 5000,
  homes: [{ id: 1, name: 'Home' }],
  days: [{ day: 'mon', mode: 'cook', cookMinutes: 30, servings: 2, homeName: 'Home' }],
  slots: [],
  recipes: [],
  pantry: [],
  deals: [],
  allergies: ['peanut'],
  diet: 'vegetarian',
  dislikes: [],
  avoidIngredients: [],
};

describe('AI agent', () => {
  it('extracts all suitable meal tags and a zero-cook restaurant through a fake provider', async () => {
    const { provider, calls } = fakeProvider(JSON.stringify(multiMealFixture));
    const result = await runRecipeExtraction(provider, 'Toast works for all meals. Add our pizza place for lunch and dinner when eating out.');
    expect(result.value.recipes[0].tags).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(result.value.recipes[1]).toMatchObject({
      name: 'Pizza place', tags: ['lunch', 'dinner', 'eating_out'],
      prepMinutes: 0, cookMinutes: 0, ingredients: [], steps: [],
    });
    expect(calls[0].messages[0].content).toContain('unless that particular day');
  });

  it('parses a meal-specific eating-out instruction without changing the other meals', async () => {
    const { provider } = fakeProvider(JSON.stringify({ message: 'Lunch out.', actions: [
      { type: 'set_meal', day: 'mon', mealType: 'lunch', mode: 'eating_out', cookMinutes: 0, enabled: true },
      { type: 'set_slot', day: 'mon', mealType: 'lunch', recipeId: 4 },
    ] }));
    const result = await runPlanEdit(provider, context, 'Monday lunch at the pizza place, please.');
    expect(result.value.actions[0]).toEqual({
      type: 'set_meal', day: 'mon', mealType: 'lunch', mode: 'eating_out', cookMinutes: 0, enabled: true,
    });
    expect(result.value.actions).toHaveLength(2);
  });
  it('passes the plan context and instruction to the provider', () => {
    const { provider, calls } = fakeProvider('{"message":"ok","actions":[]}');
    return runPlanEdit(provider, context, 'Move dinner to Tuesday').then((result) => {
      expect(calls).toHaveLength(1);
      expect(calls[0].messages[0].role).toBe('system');
      const user = calls[0].messages[1].content;
      expect(user).toContain('Current plan context');
      expect(user).toContain('Move dinner to Tuesday');
      expect(user).toContain('"today":"2026-11-10"');
      expect(result.value.message).toBe('ok');
      expect(result.meta).toMatchObject({
        promptId: 'plan-edit',
        promptVersion: '2',
        model: 'test-model',
        inputTokens: 120,
        outputTokens: 45,
      });
    });
  });

  it('builds the same user message helper the agent uses', () => {
    expect(planEditUserMessage(context, 'hello')).toContain('User request:\nhello');
  });

  it('extracts recipes from dictation without any network access', async () => {
    const { provider, calls } = fakeProvider(
      '{"message":"Saved.","recipes":[{"name":"Toast","ingredients":[{"name":"Bread"}]}]}'
    );
    const result = await runRecipeExtraction(provider, 'Toast: take bread and toast it.');
    expect(calls).toHaveLength(1);
    expect(calls[0].messages[0].content).toContain('dictates one or more recipes');
    expect(result.value.recipes[0].name).toBe('Toast');
  });

  it('extracts a leaflet with known homes in context', async () => {
    const { provider } = fakeProvider(
      '{"message":"Saved.","deals":[{"store":"Lidl","product":"Milk","price":1.29}]}'
    );
    const result = await runNewspaperExtraction(provider, 'Lidl milk 1.29', context);
    expect(result.value.deals[0]).toMatchObject({ storeName: 'Lidl', priceCents: 129 });
  });
});
