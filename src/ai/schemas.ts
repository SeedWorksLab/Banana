import {
  CURRENCIES,
  DAY_MODES,
  INGREDIENT_CATEGORIES,
  MEAL_TYPES,
  UNITS,
  WEEK_DAYS,
  type Currency,
  type DayMode,
  type IngredientCategory,
  type MealType,
  type Unit,
  type WeekDay,
} from '../models';

export interface AgentRecipeIngredient {
  name: string;
  quantity: number;
  unit: Unit;
  category: IngredientCategory;
  shelfLifeDays: number | null;
  optional: boolean;
}

export interface AgentRecipe {
  name: string;
  description: string | null;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  category: MealType;
  tags: string[];
  isWish: boolean;
  ingredients: AgentRecipeIngredient[];
  steps: string[];
}

export interface AgentShoppingItem {
  label: string;
  quantity: number;
  unit: Unit;
  category: IngredientCategory;
  saleOnly: boolean;
  homeName: string | null;
}

export type PlanEditAction =
  | {
      type: 'set_slot';
      day: WeekDay;
      mealType: MealType;
      recipeId: number | null;
      recipeName: string | null;
      freeText: string | null;
      servings: number | null;
    }
  | { type: 'clear_slot'; day: WeekDay; mealType: MealType }
  | {
      type: 'set_day';
      day: WeekDay;
      mode: DayMode | null;
      cookMinutes: number | null;
      servings: number | null;
      homeName: string | null;
    }
  | { type: 'set_home_days'; days: WeekDay[]; homeName: string }
  | { type: 'mark_cooked'; day: WeekDay; mealType: MealType; actual: string | null }
  | { type: 'replan'; days: WeekDay[] }
  | {
      type: 'create_recipe';
      recipe: AgentRecipe;
      scheduleDay: WeekDay | null;
      mealType: MealType;
    }
  | { type: 'make_wish_recipe'; recipeName: string; homeName: string | null }
  | ({ type: 'add_shopping_item' } & AgentShoppingItem)
  | { type: 'add_home'; name: string };

export interface PlanEditResult {
  message: string;
  actions: PlanEditAction[];
}

export interface RecipeExtractionResult {
  message: string;
  recipes: AgentRecipe[];
}

export interface AgentDeal {
  storeName: string;
  productName: string;
  priceCents: number;
  referencePriceCents: number | null;
  quantityText: string | null;
  validFrom: string | null;
  validTo: string | null;
  currency: Currency | null;
  rawText: string | null;
}

export interface NewspaperExtractionResult {
  message: string;
  deals: AgentDeal[];
  shoppingItems: AgentShoppingItem[];
  recipes: AgentRecipe[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const text = readString(value);
  if (text === null) {
    return null;
  }
  const normalized = text.toLowerCase();
  return allowed.find((entry) => entry.toLowerCase() === normalized) ?? null;
}

function readPositiveInt(value: unknown, fallback: number): number {
  const number = readNumber(value);
  if (number === null || number <= 0) {
    return fallback;
  }
  return Math.round(number);
}

function readDate(value: unknown): string | null {
  const text = readString(value);
  if (text === null) {
    return null;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : null;
}

function priceCents(record: JsonRecord): number | null {
  const cents = readNumber(record.priceCents ?? record.price_cents);
  if (cents !== null) {
    return Math.round(cents);
  }
  const major = readNumber(record.price);
  return major === null ? null : Math.round(major * 100);
}

export function parseAgentRecipe(value: unknown, fallbackWish = false): AgentRecipe | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = readString(value.name);
  if (name === null) {
    return null;
  }
  const ingredients: AgentRecipeIngredient[] = [];
  for (const entry of readArray(value.ingredients)) {
    if (!isRecord(entry)) {
      continue;
    }
    const ingredientName = readString(entry.name ?? entry.ingredient);
    if (ingredientName === null) {
      continue;
    }
    ingredients.push({
      name: ingredientName,
      quantity: readPositiveInt(entry.quantity, 1),
      unit: readEnum(entry.unit, UNITS) ?? 'piece',
      category: readEnum(entry.category, INGREDIENT_CATEGORIES) ?? 'other',
      shelfLifeDays: readPositiveInt(entry.shelfLifeDays, 0) || null,
      optional: readBool(entry.optional),
    });
  }
  const tags = readArray(value.tags)
    .map((tag) => readString(tag))
    .filter((tag): tag is string => tag !== null);
  const steps = readArray(value.steps)
    .map((step) => readString(step))
    .filter((step): step is string => step !== null);
  return {
    name,
    description: readString(value.description),
    servings: readPositiveInt(value.servings, 2),
    prepMinutes: readPositiveInt(value.prepMinutes, 10),
    cookMinutes: readPositiveInt(value.cookMinutes, 20),
    category: readEnum(value.category, MEAL_TYPES) ?? 'dinner',
    tags,
    isWish: readBool(value.isWish) || fallbackWish,
    ingredients,
    steps,
  };
}

function parseShoppingItem(value: unknown): AgentShoppingItem | null {
  if (!isRecord(value)) {
    return null;
  }
  const label = readString(value.label ?? value.name);
  if (label === null) {
    return null;
  }
  return {
    label,
    quantity: readPositiveInt(value.quantity, 1),
    unit: readEnum(value.unit, UNITS) ?? 'piece',
    category: readEnum(value.category, INGREDIENT_CATEGORIES) ?? 'other',
    saleOnly: readBool(value.saleOnly ?? value.onlyWhenOnSale),
    homeName: readString(value.homeName ?? value.home),
  };
}

function parsePlanEditAction(value: unknown): PlanEditAction | null {
  if (!isRecord(value)) {
    return null;
  }
  const type = readString(value.type);
  if (type === null) {
    return null;
  }
  if (type === 'set_slot') {
    const day = readEnum(value.day, WEEK_DAYS);
    if (day === null) {
      return null;
    }
    const recipeId = readNumber(value.recipeId);
    return {
      type,
      day,
      mealType: readEnum(value.mealType, MEAL_TYPES) ?? 'dinner',
      recipeId: recipeId !== null ? Math.round(recipeId) : null,
      recipeName: readString(value.recipeName ?? value.recipe),
      freeText: readString(value.freeText ?? value.meal),
      servings: readNumber(value.servings) === null ? null : readPositiveInt(value.servings, 2),
    };
  }
  if (type === 'clear_slot') {
    const day = readEnum(value.day, WEEK_DAYS);
    return day === null
      ? null
      : { type, day, mealType: readEnum(value.mealType, MEAL_TYPES) ?? 'dinner' };
  }
  if (type === 'set_day') {
    const day = readEnum(value.day, WEEK_DAYS);
    if (day === null) {
      return null;
    }
    return {
      type,
      day,
      mode: readEnum(value.mode, DAY_MODES),
      cookMinutes:
        readNumber(value.cookMinutes) === null ? null : readPositiveInt(value.cookMinutes, 45),
      servings: readNumber(value.servings) === null ? null : readPositiveInt(value.servings, 2),
      homeName: readString(value.homeName ?? value.home),
    };
  }
  if (type === 'set_home_days') {
    const days = readArray(value.days)
      .map((day) => readEnum(day, WEEK_DAYS))
      .filter((day): day is WeekDay => day !== null);
    const homeName = readString(value.homeName ?? value.home);
    return days.length === 0 || homeName === null ? null : { type, days, homeName };
  }
  if (type === 'mark_cooked') {
    const day = readEnum(value.day, WEEK_DAYS);
    return day === null
      ? null
      : {
          type,
          day,
          mealType: readEnum(value.mealType, MEAL_TYPES) ?? 'dinner',
          actual: readString(value.actual ?? value.meal ?? value.freeText),
        };
  }
  if (type === 'replan') {
    const days = readArray(value.days)
      .map((day) => readEnum(day, WEEK_DAYS))
      .filter((day): day is WeekDay => day !== null);
    return { type, days: days.length > 0 ? days : [...WEEK_DAYS] };
  }
  if (type === 'create_recipe') {
    const recipe = parseAgentRecipe(value.recipe ?? value, readBool(value.isWish));
    if (recipe === null) {
      return null;
    }
    return {
      type,
      recipe,
      scheduleDay: readEnum(value.scheduleDay, WEEK_DAYS),
      mealType: readEnum(value.mealType, MEAL_TYPES) ?? 'dinner',
    };
  }
  if (type === 'make_wish_recipe') {
    const recipeName = readString(value.recipeName ?? value.recipe ?? value.name);
    return recipeName === null
      ? null
      : { type, recipeName, homeName: readString(value.homeName ?? value.home) };
  }
  if (type === 'add_shopping_item') {
    const item = parseShoppingItem(value);
    return item === null ? null : { type, ...item };
  }
  if (type === 'add_home') {
    const name = readString(value.name);
    return name === null ? null : { type, name };
  }
  return null;
}

export function parsePlanEditValue(value: unknown): PlanEditResult {
  const record = isRecord(value) ? value : {};
  const message =
    readString(record.message) ?? readString(record.summary) ?? 'Updated your plan.';
  const actions = readArray(record.actions)
    .map(parsePlanEditAction)
    .filter((action): action is PlanEditAction => action !== null);
  return { message, actions };
}

export function parseRecipeExtractionValue(value: unknown): RecipeExtractionResult {
  const record = isRecord(value) ? value : {};
  const message = readString(record.message) ?? 'Recipes saved.';
  const recipes = readArray(record.recipes)
    .map((recipe) => parseAgentRecipe(recipe))
    .filter((recipe): recipe is AgentRecipe => recipe !== null);
  if (recipes.length === 0) {
    const single = parseAgentRecipe(record.recipe ?? value);
    if (single !== null) {
      recipes.push(single);
    }
  }
  return { message, recipes };
}

function parseAgentDeal(value: unknown): AgentDeal | null {
  if (!isRecord(value)) {
    return null;
  }
  const storeName = readString(value.storeName ?? value.store);
  const productName = readString(value.productName ?? value.product ?? value.name);
  const price = priceCents(value);
  if (storeName === null || productName === null || price === null || price <= 0) {
    return null;
  }
  const referenceCents = readNumber(value.referencePriceCents ?? value.wasPriceCents);
  return {
    storeName,
    productName,
    priceCents: price,
    referencePriceCents:
      referenceCents !== null ? Math.round(referenceCents) : readNumber(value.wasPrice) === null
        ? null
        : Math.round((readNumber(value.wasPrice) ?? 0) * 100),
    quantityText: readString(value.quantityText ?? value.quantity),
    validFrom: readDate(value.validFrom ?? value.startDate),
    validTo: readDate(value.validTo ?? value.endDate),
    currency: readEnum(value.currency, CURRENCIES),
    rawText: readString(value.rawText),
  };
}

export function parseNewspaperValue(value: unknown): NewspaperExtractionResult {
  const record = isRecord(value) ? value : {};
  return {
    message: readString(record.message) ?? 'Saved what you read.',
    deals: readArray(record.deals)
      .map(parseAgentDeal)
      .filter((deal): deal is AgentDeal => deal !== null),
    shoppingItems: readArray(record.shoppingItems)
      .map(parseShoppingItem)
      .filter((item): item is AgentShoppingItem => item !== null),
    recipes: readArray(record.recipes)
      .map((recipe) => parseAgentRecipe(recipe, true))
      .filter((recipe): recipe is AgentRecipe => recipe !== null),
  };
}
