import type { Language } from '../i18n/types';

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export const MAIN_MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner'];
export const MEAL_MODES = ['cook', 'no_cook', 'leftovers', 'eating_out'] as const;
export type MealMode = (typeof MEAL_MODES)[number];
export const EATING_OUT_TAG = 'eating_out';

export interface MealSetting {
  mealType: MealType;
  mode: MealMode;
  cookMinutes: number;
  enabled: boolean;
}

export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export const DAY_MODES = ['cook', 'no_cook', 'leftovers'] as const;
export type DayMode = (typeof DAY_MODES)[number];

export const WEEK_STATUSES = [
  'planning',
  'shopping',
  'cooking',
  'completed',
  'archived',
] as const;
export type WeekStatus = (typeof WEEK_STATUSES)[number];

export const SLOT_KINDS = ['recipe', 'free_text', 'leftovers', 'empty'] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

export const PANTRY_LEVELS = ['stocked', 'low', 'out'] as const;
export type PantryLevel = (typeof PANTRY_LEVELS)[number];

export const DIETS = ['omnivore', 'vegetarian', 'vegan', 'pescatarian'] as const;
export type Diet = (typeof DIETS)[number];

export const INGREDIENT_CATEGORIES = [
  'produce',
  'bakery',
  'meat_fish',
  'dairy',
  'pantry',
  'frozen',
  'drinks',
  'household',
  'other',
] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'piece',
  'tbsp',
  'tsp',
  'pinch',
  'clove',
  'slice',
  'can',
  'pack',
  'bunch',
  'to_taste',
] as const;
export type Unit = (typeof UNITS)[number];

export const COUNTRIES = ['AT', 'HU'] as const;
export type Country = (typeof COUNTRIES)[number];

export const CURRENCIES = ['EUR', 'HUF'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const STORE_IDS = [
  'lidl',
  'hofer',
  'spar',
  'billa_at',
  'dm_at',
  'tedi_at',
  'aldi_hu',
  'lidl_hu',
  'spar_hu',
] as const;
export type StoreId = (typeof STORE_IDS)[number];

export const STORE_COUNTRIES: Record<StoreId, Country> = {
  lidl: 'AT',
  hofer: 'AT',
  spar: 'AT',
  billa_at: 'AT',
  dm_at: 'AT',
  tedi_at: 'AT',
  aldi_hu: 'HU',
  lidl_hu: 'HU',
  spar_hu: 'HU',
};

export const STORE_CURRENCIES: Record<StoreId, Currency> = {
  lidl: 'EUR',
  hofer: 'EUR',
  spar: 'EUR',
  billa_at: 'EUR',
  dm_at: 'EUR',
  tedi_at: 'EUR',
  aldi_hu: 'HUF',
  lidl_hu: 'HUF',
  spar_hu: 'HUF',
};

export const RECIPE_SOURCES = ['builtin', 'own', 'ai'] as const;
export type RecipeSource = (typeof RECIPE_SOURCES)[number];

export const MATCH_STATUSES = ['auto', 'confirmed', 'rejected'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const SCRAPE_RUN_STATUSES = ['pending', 'succeeded', 'partial', 'failed'] as const;
export type ScrapeRunStatus = (typeof SCRAPE_RUN_STATUSES)[number];

export const AI_RUN_KINDS = [
  'plan_proposal',
  'gap_fill',
  'narrative',
  'plan_edit',
  'recipe_extract',
  'newspaper',
] as const;
export type AiRunKind = (typeof AI_RUN_KINDS)[number];

export const AI_RUN_STATUSES = ['pending', 'succeeded', 'failed'] as const;
export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];

export const SLOT_EVENT_KINDS = [
  'created',
  'recipe_set',
  'cleared',
  'servings_set',
  'day_changed',
  'note',
] as const;
export type SlotEventKind = (typeof SLOT_EVENT_KINDS)[number];

export interface Settings {
  username: string | null;
  language: Language;
  themeMode: ThemeMode;
  currency: Currency;
  defaultServings: number;
  defaultWeeknightMinutes: number;
  defaultWeekendMinutes: number;
  dinnerOnly: boolean;
  planStartDay: WeekDay;
  notificationsEnabled: boolean;
  shoppingReminderHour: number;
  planReminderDay: WeekDay;
  tutorialSeen: boolean;
  lastSeenRelease: string | null;
}

export interface AiState {
  llmBaseUrl: string | null;
  llmApiKey: string | null;
  llmModel: string | null;
  enabled: boolean;
  lastError: string | null;
}

export interface Preferences {
  diet: Diet;
  allergies: string[];
  dislikes: string[];
  defaultServings: number;
  maxMinutesWeeknight: number;
  maxMinutesWeekend: number;
  weeklyBudgetCents: number;
  householdName: string | null;
}

export interface Home {
  id: number;
  uuid: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface Ingredient {
  id: number;
  uuid: string | null;
  name: string;
  category: IngredientCategory;
  defaultUnit: Unit;
  defaultQuantity: number | null;
  isPantryStaple: boolean;
  shelfLifeDays: number | null;
  notes: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface IngredientAlias {
  id: number;
  uuid: string | null;
  ingredientId: number;
  alias: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface Store {
  id: number;
  uuid: string | null;
  storeId: StoreId;
  name: string;
  country: Country;
  currency: Currency;
  offersUrl: string;
  enabled: boolean;
  lastScrapedAt: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface Recipe {
  id: number;
  uuid: string | null;
  name: string;
  description: string | null;
  category: MealType;
  source: RecipeSource;
  isBuiltin: boolean;
  isFavorite: boolean;
  isWish: boolean;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  notes: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface RecipeIngredient {
  id: number;
  uuid: string | null;
  recipeId: number;
  ingredientId: number;
  quantity: number;
  unit: Unit;
  note: string | null;
  optional: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface RecipeStep {
  id: number;
  uuid: string | null;
  recipeId: number;
  stepIndex: number;
  instruction: string;
  durationMinutes: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface RecipeTag {
  id: number;
  uuid: string | null;
  recipeId: number;
  tag: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface PantryItem {
  id: number;
  uuid: string | null;
  ingredientId: number;
  homeId: number;
  level: PantryLevel;
  quantity: number | null;
  unit: Unit | null;
  expiresOn: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface Week {
  id: number;
  uuid: string | null;
  weekStartDate: string;
  status: WeekStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface WeekDayBudget {
  id: number;
  uuid: string | null;
  weekId: number;
  day: WeekDay;
  mode: DayMode;
  cookMinutes: number;
  servings: number | null;
  homeId: number | null;
  mealSettings: MealSetting[];
  createdAt: string;
  updatedAt: string | null;
}

export interface Slot {
  batchSourceUuid: string | null;
  id: number;
  uuid: string | null;
  weekId: number;
  day: WeekDay;
  mealType: MealType;
  kind: SlotKind;
  recipeId: number | null;
  freeText: string | null;
  servings: number;
  note: string | null;
  pinned: boolean;
  cookedAt: string | null;
  rating: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface SlotEvent {
  id: number;
  uuid: string | null;
  slotId: number;
  kind: SlotEventKind;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ShoppingItem {
  id: number;
  uuid: string | null;
  weekId: number;
  homeId: number | null;
  ingredientId: number | null;
  label: string;
  category: IngredientCategory;
  quantity: number;
  unit: Unit;
  checked: boolean;
  manual: boolean;
  saleOnly: boolean;
  dealId: number | null;
  priceCents: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface Deal {
  id: number;
  uuid: string | null;
  storeId: number;
  productName: string;
  brand: string | null;
  priceCents: number;
  currency: Currency;
  referencePriceCents: number | null;
  unit: string | null;
  quantityText: string | null;
  validFrom: string | null;
  validTo: string | null;
  sourceUrl: string | null;
  scrapedAt: string;
  rawText: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface DealMatch {
  id: number;
  uuid: string | null;
  dealId: number;
  ingredientId: number;
  confidence: number;
  status: MatchStatus;
  createdAt: string;
  updatedAt: string | null;
}

export interface ScrapeRun {
  id: number;
  uuid: string | null;
  storeId: number;
  status: ScrapeRunStatus;
  dealsFound: number;
  dealsNew: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface AiRun {
  id: number;
  uuid: string | null;
  weekId: number | null;
  kind: AiRunKind;
  promptId: string | null;
  promptVersion: string | null;
  model: string | null;
  status: AiRunStatus;
  requestSummary: string | null;
  responseJson: string | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstimateCents: number | null;
  createdAt: string;
  updatedAt: string | null;
}
