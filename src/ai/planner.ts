import {
  parseNewspaperValue,
  parsePlanEditValue,
  parseRecipeExtractionValue,
  type NewspaperExtractionResult,
  type PlanEditResult,
  type RecipeExtractionResult,
} from './schemas';

export class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiParseError';
  }
}

export interface PlanEditContext {
  today: string;
  weekStart: string;
  weeklyBudgetCents: number | null;
  homes: { id: number; name: string }[];
  days: {
    day: string;
    mode: string;
    cookMinutes: number;
    servings: number;
    homeName: string | null;
  }[];
  slots: {
    day: string;
    mealType: string;
    kind: string;
    recipeId: number | null;
    recipeName: string | null;
    freeText: string | null;
    servings: number;
    pinned: boolean;
    cookedAt: string | null;
  }[];
  recipes: {
    id: number;
    name: string;
    minutes: number;
    category: string;
    tags: string[];
    isWish: boolean;
    ingredients: string[];
  }[];
  pantry: {
    ingredientId: number;
    name: string;
    homeName: string;
    level: string;
    quantity: number | null;
    unit: string | null;
    expiresOn: string | null;
  }[];
  deals: {
    storeName: string;
    productName: string;
    priceCents: number;
    referencePriceCents: number | null;
    validTo: string | null;
    ingredientNames: string[];
  }[];
  allergies: string[];
  diet: string | null;
  dislikes: string[];
  avoidIngredients: string[];
}

export function buildPlanEditContext(context: PlanEditContext): string {
  return JSON.stringify(context);
}

export function extractJsonObject(text: string): unknown {
  const withoutFences = text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new AiParseError('The AI reply did not contain a JSON object');
  }
  const candidate = withoutFences.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    const repaired = candidate.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(repaired);
    } catch {
      throw new AiParseError('The AI reply was not valid JSON');
    }
  }
}

export function parsePlanEditResponse(text: string): PlanEditResult {
  return parsePlanEditValue(extractJsonObject(text));
}

export function parseRecipeExtractionResponse(text: string): RecipeExtractionResult {
  return parseRecipeExtractionValue(extractJsonObject(text));
}

export function parseNewspaperResponse(text: string): NewspaperExtractionResult {
  return parseNewspaperValue(extractJsonObject(text));
}
