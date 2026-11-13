import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  AiRun,
  AiRunKind,
  AiState,
  Currency,
  Deal,
  DealMatch,
  DayMode,
  Home,
  Ingredient,
  IngredientCategory,
  MatchStatus,
  PantryItem,
  PantryLevel,
  Preferences,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  RecipeTag,
  Settings,
  ShoppingItem,
  Slot,
  Store,
  Unit,
  Week,
  WeekDay,
  WeekDayBudget,
  WeekStatus,
} from '../models';
import { getDatabase } from '../database/database';
import { DEFAULT_SETTINGS, getSettings, updateSettings } from '../database/settings';
import {
  DEFAULT_AI_STATE,
  clearAiCredentials as clearAiCredentialsRow,
  getAiState,
  updateAiState,
} from '../database/aiState';
import { DEFAULT_PREFERENCES, getPreferences, updatePreferences } from '../database/preferences';
import {
  createIngredient,
  deleteIngredient,
  getAllIngredients,
  updateIngredient,
  type IngredientInput,
} from '../database/ingredients';
import {
  createRecipe,
  deleteRecipe,
  getAllRecipes,
  updateRecipe,
  type RecipeInput,
} from '../database/recipes';
import { createRecipeIngredient, getAllRecipeIngredients } from '../database/recipeIngredients';
import { createRecipeStep, getAllRecipeSteps } from '../database/recipeSteps';
import { addRecipeTag, getAllRecipeTags, setRecipeTags as setRecipeTagsRow } from '../database/recipeTags';
import {
  deletePantryItem,
  getAllPantryItems,
  setPantryExpiry as setPantryExpiryRow,
  setPantryLevel,
} from '../database/pantry';
import {
  createHome as createHomeRow,
  deleteHome as deleteHomeRow,
  getAllHomes,
  getDefaultHome,
  updateHome as updateHomeRow,
} from '../database/homes';
import { getAllStores, setStoreEnabled, setStoreOffersUrl } from '../database/stores';
import { createDeal as createDealRow, getAllDeals } from '../database/deals';
import { ensureDealMatch, getAllDealMatches, setDealMatchStatus } from '../database/dealMatches';
import { getAllIngredientAliases } from '../database/ingredientAliases';
import { matchIngredients } from '../deals/matcher';
import { createAiRun, getAiRuns } from '../database/aiRuns';
import {
  createSlot as createSlotRow,
  deleteSlot as deleteSlotRow,
  getSlotsByWeek,
  getRecipeHistory,
  markSlotCooked as markSlotCookedRow,
  setSlotRating as setSlotRatingRow,
  updateSlot as updateSlotRow,
  type SlotInput,
} from '../database/slots';
import {
  createShoppingItem,
  getShoppingItems,
  replaceGeneratedShoppingItems,
  setShoppingItemChecked,
} from '../database/shoppingItems';
import {
  getWeekDayBudgets,
  setWeekDayHome as setWeekDayHomeRow,
  upsertWeekDayBudget,
} from '../database/weekDayBudgets';
import { ensureWeek, getWeek, setWeekStatus as setWeekStatusRow } from '../database/weeks';
import { isoNow, todayDate, weekStart } from '../utils/date';
import { buildShoppingList, type PlannedMeal } from '../services/shopping-list-service';
import type { RatingEntry } from '../services/recipe-service';
import { matchTicketLines, parseTicketText } from '../services/ticket-service';
import {
  bestDealForIngredient,
  isDealActive,
  type IngredientDeal,
} from '../services/deal-service';
import { expiringIngredientIds } from '../services/expiry-service';
import { planGap, type PlannerRecipe } from '../services/planning-service';
import { filterRecipesForPreferences } from '../services/preference-service';
import { wishRecipeShoppingLines } from '../services/wish-recipe-service';
import { notifyPlanUpdated } from '../services/notifications';
import {
  buildIngredientFactsByRecipe,
  buildIngredientNamesByRecipe,
  buildPlannerRecipes,
  buildRecipeSummaries,
} from './selectors';
import { refreshDeals as refreshDealsFromStores, type DealRefreshStoreResult } from '../deals';
import { runNewspaperExtraction, runPlanEdit, runRecipeExtraction, type AgentRunMeta } from '../ai/agent';
import { createOpenAiCompatibleProvider } from '../ai/openai-compatible';
import type { AiProvider } from '../ai/provider';
import type { PlanEditContext } from '../ai/planner';
import type {
  AgentRecipe,
  AgentShoppingItem,
  PlanEditAction,
} from '../ai/schemas';

export interface WeekPlan {
  week: Week;
  budgets: WeekDayBudget[];
  slots: Slot[];
  shoppingItems: ShoppingItem[];
}

export interface ManualShoppingItemInput {
  label: string;
  category: IngredientCategory;
  quantity: number;
  unit: Unit;
  homeId: number | null;
  saleOnly: boolean;
}

export interface RecipeIngredientDraft {
  ingredientId: number;
  quantity: number;
  unit: Unit;
  note: string | null;
  optional: boolean;
}

export interface RecipeStepDraft {
  instruction: string;
  durationMinutes: number | null;
}

export interface AgentOutcome {
  message: string;
  changedDays: WeekDay[];
}

export interface RecipeDictationOutcome {
  message: string;
  recipeIds: number[];
}

export interface NewspaperOutcome {
  message: string;
  dealCount: number;
  shoppingItemCount: number;
  recipeIds: number[];
}

export interface AppData {
  ready: boolean;
  error: string | null;
  settings: Settings;
  aiState: AiState;
  preferences: Preferences;
  ingredients: Ingredient[];
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
  recipeSteps: RecipeStep[];
  recipeTags: RecipeTag[];
  recipeHistory: RatingEntry[];
  homes: Home[];
  defaultHome: Home | null;
  pantryItems: PantryItem[];
  stores: Store[];
  deals: Deal[];
  dealMatches: DealMatch[];
  aiRuns: AiRun[];
  refreshingDeals: boolean;
  lastDealRefresh: DealRefreshStoreResult[] | null;
  refresh: () => Promise<void>;
  refreshDeals: () => Promise<DealRefreshStoreResult[]>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  saveAiState: (patch: Partial<AiState>) => Promise<void>;
  clearAiCredentials: () => Promise<void>;
  savePreferences: (patch: Partial<Preferences>) => Promise<void>;
  addHome: (name: string) => Promise<number>;
  renameHome: (id: number, name: string) => Promise<void>;
  removeHome: (id: number) => Promise<void>;
  addIngredient: (input: IngredientInput) => Promise<number>;
  saveIngredient: (id: number, input: IngredientInput) => Promise<void>;
  removeIngredient: (id: number) => Promise<void>;
  addRecipe: (input: RecipeInput) => Promise<number>;
  saveRecipe: (id: number, input: RecipeInput) => Promise<void>;
  removeRecipe: (id: number) => Promise<void>;
  replaceRecipeTags: (recipeId: number, tags: readonly string[]) => Promise<void>;
  addOneRecipeTag: (recipeId: number, tag: string) => Promise<void>;
  replaceRecipeIngredients: (recipeId: number, items: readonly RecipeIngredientDraft[]) => Promise<void>;
  replaceRecipeSteps: (recipeId: number, steps: readonly RecipeStepDraft[]) => Promise<void>;
  setPantryLevel: (
    ingredientId: number,
    homeId: number,
    level: PantryLevel,
    expiresOn?: string | null
  ) => Promise<void>;
  setPantryExpiry: (
    ingredientId: number,
    homeId: number,
    expiresOn: string | null
  ) => Promise<void>;
  importTicket: (
    text: string,
    homeId?: number
  ) => Promise<{
    matched: { ingredientId: number; name: string; line: string }[];
    unmatched: string[];
  }>;
  removePantryItem: (ingredientId: number, homeId: number) => Promise<void>;
  setStoreEnabled: (id: number, enabled: boolean) => Promise<void>;
  setStoreOffersUrl: (id: number, url: string) => Promise<void>;
  setDealMatchStatus: (id: number, status: MatchStatus) => Promise<void>;
  recordAiRun: (input: Omit<AiRun, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>) => Promise<number>;
  loadWeekPlan: (weekStartDate: string) => Promise<WeekPlan>;
  setDayBudget: (
    weekId: number,
    day: WeekDay,
    mode: DayMode,
    cookMinutes: number,
    servings: number | null,
    homeId?: number | null
  ) => Promise<void>;
  setDayHome: (weekId: number, day: WeekDay, homeId: number | null) => Promise<void>;
  setDayWish: (
    weekId: number,
    day: WeekDay,
    recipeId: number | null,
    freeText: string | null,
    servings: number
  ) => Promise<void>;
  createSlot: (input: SlotInput) => Promise<number>;
  updateSlot: (id: number, input: Omit<SlotInput, 'weekId'>) => Promise<void>;
  deleteSlot: (id: number) => Promise<void>;
  setSlotRating: (id: number, rating: number | null) => Promise<void>;
  setWeekStatus: (weekId: number, status: WeekStatus) => Promise<void>;
  applyPlanInstruction: (weekId: number, instruction: string) => Promise<AgentOutcome>;
  createRecipesFromText: (transcript: string) => Promise<RecipeDictationOutcome>;
  importNewspaperText: (transcript: string) => Promise<NewspaperOutcome>;
  addWishRecipeIngredients: (recipeId: number, homeId: number) => Promise<number>;
  regenerateShoppingList: (weekId: number) => Promise<ShoppingItem[]>;
  loadShoppingItems: (weekId: number) => Promise<ShoppingItem[]>;
  setShoppingItemChecked: (id: number, checked: boolean) => Promise<void>;
  addManualShoppingItem: (weekId: number, input: ManualShoppingItemInput) => Promise<number>;
  removeShoppingItem: (id: number) => Promise<void>;
}

const DataContext = createContext<AppData | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [aiState, setAiState] = useState<AiState>(DEFAULT_AI_STATE);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeSteps, setRecipeSteps] = useState<RecipeStep[]>([]);
  const [recipeTags, setRecipeTags] = useState<RecipeTag[]>([]);
  const [recipeHistory, setRecipeHistory] = useState<RatingEntry[]>([]);
  const [homes, setHomes] = useState<Home[]>([]);
  const [defaultHome, setDefaultHome] = useState<Home | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealMatches, setDealMatches] = useState<DealMatch[]>([]);
  const [aiRuns, setAiRuns] = useState<AiRun[]>([]);
  const [refreshingDeals, setRefreshingDeals] = useState(false);
  const [lastDealRefresh, setLastDealRefresh] = useState<DealRefreshStoreResult[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const db = await getDatabase();
      const [
        nextSettings,
        nextAiState,
        nextPreferences,
        nextIngredients,
        nextRecipes,
        nextRecipeIngredients,
        nextRecipeSteps,
        nextRecipeTags,
        nextRecipeHistory,
        nextHomes,
        nextDefaultHome,
        nextPantryItems,
        nextStores,
        nextDeals,
        nextMatches,
        nextAiRuns,
      ] = await Promise.all([
        getSettings(db),
        getAiState(db),
        getPreferences(db),
        getAllIngredients(db),
        getAllRecipes(db),
        getAllRecipeIngredients(db),
        getAllRecipeSteps(db),
        getAllRecipeTags(db),
        getRecipeHistory(db),
        getAllHomes(db),
        getDefaultHome(db),
        getAllPantryItems(db),
        getAllStores(db),
        getAllDeals(db),
        getAllDealMatches(db),
        getAiRuns(50, db),
      ]);
      setSettings(nextSettings);
      setAiState(nextAiState);
      setPreferences(nextPreferences);
      setIngredients(nextIngredients);
      setRecipes(nextRecipes);
      setRecipeIngredients(nextRecipeIngredients);
      setRecipeSteps(nextRecipeSteps);
      setRecipeTags(nextRecipeTags);
      setRecipeHistory(nextRecipeHistory);
      setHomes(nextHomes);
      setDefaultHome(nextDefaultHome);
      setPantryItems(nextPantryItems);
      setStores(nextStores);
      setDeals(nextDeals);
      setDealMatches(nextMatches);
      setAiRuns(nextAiRuns);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load local data');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      await refresh();
      if (active) {
        setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const value = useMemo<AppData>(() => {
    const withDb = async <T,>(fn: (db: SQLiteDatabase) => Promise<T>): Promise<T> => {
      const db = await getDatabase();
      return fn(db);
    };

    const provider: AiProvider | null =
      aiState.enabled && aiState.llmBaseUrl && aiState.llmModel
        ? createOpenAiCompatibleProvider({
            baseUrl: aiState.llmBaseUrl,
            apiKey: aiState.llmApiKey ?? '',
            model: aiState.llmModel,
          })
        : null;

    const requireProvider = (): AiProvider => {
      if (!provider) {
        throw new Error('Configure the AI provider in Settings first.');
      }
      return provider;
    };

    const recordSuccess = async (
      db: SQLiteDatabase,
      weekId: number | null,
      kind: AiRunKind,
      meta: AgentRunMeta
    ): Promise<void> => {
      await createAiRun(
        {
          weekId,
          kind,
          promptId: meta.promptId,
          promptVersion: meta.promptVersion,
          model: meta.model,
          status: 'succeeded',
          requestSummary: meta.requestText,
          responseJson: meta.responseText,
          error: null,
          inputTokens: meta.inputTokens,
          outputTokens: meta.outputTokens,
          costEstimateCents: null,
        },
        db
      );
    };

    const recordFailure = async (
      db: SQLiteDatabase,
      weekId: number | null,
      kind: AiRunKind,
      message: string
    ): Promise<void> => {
      await createAiRun(
        {
          weekId,
          kind,
          promptId: null,
          promptVersion: null,
          model: aiState.llmModel,
          status: 'failed',
          requestSummary: null,
          responseJson: null,
          error: message,
          inputTokens: null,
          outputTokens: null,
          costEstimateCents: null,
        },
        db
      );
    };

    const apply = async (
      weekId: number,
      instruction: string,
      kind: AiRunKind
    ): Promise<AgentOutcome> => {
      const ai = requireProvider();
      const db = await getDatabase();
      const [budgets, slots, week] = await Promise.all([
        getWeekDayBudgets(weekId, db),
        getSlotsByWeek(weekId, db),
        getWeek(weekId, db),
      ]);
      const context = buildAgentContext({
        weekStartDate: week?.weekStartDate ?? weekStart(todayDate()),
        budgets,
        slots,
        homes,
        defaultHome,
        stores,
        recipes,
        recipeIngredients,
        ingredients,
        pantryItems,
        deals,
        dealMatches,
        preferences,
      });
      try {
        const result = await runPlanEdit(ai, context, instruction);
        await recordSuccess(db, weekId, kind, result.meta);
        const changedDays = await applyPlanActions(db, weekId, result.value.actions, {
          preferences,
          settings,
        });
        await refresh();
        void notifyPlanUpdated(result.value.message);
        return { message: result.value.message, changedDays: [...changedDays] };
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'The AI request failed';
        await recordFailure(db, weekId, kind, message);
        await refresh();
        throw caught;
      }
    };

    const dictationContext = async (db: SQLiteDatabase): Promise<PlanEditContext> => {
      const week = await ensureWeek(weekStart(todayDate()), db);
      const [budgets, slots] = await Promise.all([
        getWeekDayBudgets(week.id, db),
        getSlotsByWeek(week.id, db),
      ]);
      return buildAgentContext({
        weekStartDate: week.weekStartDate,
        budgets,
        slots,
        homes,
        defaultHome,
        stores,
        recipes,
        recipeIngredients,
        ingredients,
        pantryItems,
        deals,
        dealMatches,
        preferences,
      });
    };

    return {
      ready,
      error,
      settings,
      aiState,
      preferences,
      ingredients,
      recipes,
      recipeIngredients,
      recipeSteps,
      recipeTags,
      recipeHistory,
      homes,
      defaultHome,
      pantryItems,
      stores,
      deals,
      dealMatches,
      aiRuns,
      refreshingDeals,
      lastDealRefresh,
      refresh,
      refreshDeals: async () => {
        setRefreshingDeals(true);
        try {
          const db = await getDatabase();
          const results = await refreshDealsFromStores({ db });
          await refresh();
          setLastDealRefresh(results);
          return results;
        } finally {
          setRefreshingDeals(false);
        }
      },
      saveSettings: async (patch) => {
        setSettings(await withDb((db) => updateSettings(patch, db)));
      },
      saveAiState: async (patch) => {
        setAiState(await withDb((db) => updateAiState(patch, db)));
      },
      clearAiCredentials: async () => {
        setAiState(await withDb((db) => clearAiCredentialsRow(db)));
      },
      savePreferences: async (patch) => {
        setPreferences(await withDb((db) => updatePreferences(patch, db)));
      },
      addHome: async (name) => {
        const id = await withDb((db) => createHomeRow({ name }, db));
        await refresh();
        return id;
      },
      renameHome: async (id, name) => {
        await withDb((db) => updateHomeRow(id, { name }, db));
        await refresh();
      },
      removeHome: async (id) => {
        await withDb((db) => deleteHomeRow(id, db));
        await refresh();
      },
      addIngredient: async (input) => {
        const id = await withDb((db) => createIngredient(input, db));
        await refresh();
        return id;
      },
      saveIngredient: async (id, input) => {
        await withDb((db) => updateIngredient(id, input, db));
        await refresh();
      },
      removeIngredient: async (id) => {
        await withDb((db) => deleteIngredient(id, db));
        await refresh();
      },
      addRecipe: async (input) => {
        const id = await withDb((db) => createRecipe(input, db));
        await refresh();
        return id;
      },
      saveRecipe: async (id, input) => {
        await withDb((db) => updateRecipe(id, input, db));
        await refresh();
      },
      removeRecipe: async (id) => {
        await withDb((db) => deleteRecipe(id, db));
        await refresh();
      },
      replaceRecipeTags: async (recipeId, tags) => {
        await withDb((db) => setRecipeTagsRow(recipeId, tags, db));
        await refresh();
      },
      addOneRecipeTag: async (recipeId, tag) => {
        await withDb((db) => addRecipeTag(recipeId, tag, db));
        await refresh();
      },
      replaceRecipeIngredients: async (recipeId, items) => {
        await withDb(async (db) => {
          const existing = await getAllRecipeIngredients(db);
          for (const row of existing.filter((candidate) => candidate.recipeId === recipeId)) {
            await db.runAsync('DELETE FROM recipe_ingredients WHERE id = ?', [row.id]);
          }
          let order = 0;
          for (const item of items) {
            await createRecipeIngredient(
              {
                recipeId,
                ingredientId: item.ingredientId,
                quantity: item.quantity,
                unit: item.unit,
                note: item.note,
                optional: item.optional,
                sortOrder: order,
              },
              db
            );
            order += 1;
          }
        });
        await refresh();
      },
      replaceRecipeSteps: async (recipeId, steps) => {
        await withDb(async (db) => {
          const existing = await getAllRecipeSteps(db);
          for (const row of existing.filter((candidate) => candidate.recipeId === recipeId)) {
            await db.runAsync('DELETE FROM recipe_steps WHERE id = ?', [row.id]);
          }
          let index = 0;
          for (const step of steps) {
            await createRecipeStep(
              {
                recipeId,
                stepIndex: index,
                instruction: step.instruction,
                durationMinutes: step.durationMinutes,
              },
              db
            );
            index += 1;
          }
        });
        await refresh();
      },
      setPantryLevel: async (ingredientId, homeId, level, expiresOn = null) => {
        await withDb((db) => setPantryLevel(ingredientId, homeId, level, expiresOn, db));
        await refresh();
      },
      setPantryExpiry: async (ingredientId, homeId, expiresOn) => {
        await withDb((db) => setPantryExpiryRow(ingredientId, homeId, expiresOn, db));
        await refresh();
      },
      importTicket: async (text, homeId) => {
        const lines = parseTicketText(text);
        const matches = matchTicketLines(lines, ingredients);
        const targetHomeId = homeId ?? defaultHome?.id ?? null;
        if (targetHomeId === null) {
          throw new Error('No home is configured');
        }
        const matched = matches.filter(
          (match): match is typeof match & { ingredientId: number; ingredientName: string } =>
            match.ingredientId !== null && match.ingredientName !== null
        );
        await withDb(async (db) => {
          for (const match of matched) {
            await setPantryLevel(match.ingredientId, targetHomeId, 'stocked', null, db);
          }
        });
        await refresh();
        return {
          matched: matched.map((match) => ({
            ingredientId: match.ingredientId,
            name: match.ingredientName,
            line: match.line,
          })),
          unmatched: matches.filter((match) => match.ingredientId === null).map((match) => match.line),
        };
      },
      removePantryItem: async (ingredientId, homeId) => {
        await withDb((db) => deletePantryItem(ingredientId, homeId, db));
        await refresh();
      },
      setStoreEnabled: async (id, enabled) => {
        await withDb((db) => setStoreEnabled(id, enabled, db));
        await refresh();
      },
      setStoreOffersUrl: async (id, url) => {
        await withDb((db) => setStoreOffersUrl(id, url, db));
        await refresh();
      },
      setDealMatchStatus: async (id, status) => {
        await withDb((db) => setDealMatchStatus(id, status, db));
        await refresh();
      },
      recordAiRun: async (input) => withDb((db) => createAiRun(input, db)),
      loadWeekPlan: async (weekStartDate) =>
        withDb(async (db) => {
          const week = await ensureWeek(weekStartDate, db);
          const [budgets, slots, shoppingItems] = await Promise.all([
            getWeekDayBudgets(week.id, db),
            getSlotsByWeek(week.id, db),
            getShoppingItems(week.id, db),
          ]);
          return { week, budgets, slots, shoppingItems };
        }),
      setDayBudget: async (weekId, day, mode, cookMinutes, servings, homeId) => {
        await withDb(async (db) => {
          await upsertWeekDayBudget(
            { weekId, day, mode, cookMinutes, servings, homeId },
            db
          );
          const slots = await getSlotsByWeek(weekId, db);
          for (const slot of slots) {
            if (slot.day !== day || slot.kind === 'empty') {
              continue;
            }
            await updateSlotRow(
              slot.id,
              {
                day: slot.day,
                mealType: slot.mealType,
                kind: slot.kind,
                recipeId: slot.recipeId,
                freeText: slot.freeText,
                servings: servings ?? preferences.defaultServings,
                note: slot.note,
                pinned: slot.pinned,
                sortOrder: slot.sortOrder,
              },
              db
            );
          }
        });
      },
      setDayHome: async (weekId, day, homeId) => {
        await withDb((db) => setWeekDayHomeRow(weekId, day, homeId, db));
        await refresh();
      },
      setDayWish: async (weekId, day, recipeId, freeText, servings) => {
        await withDb(async (db) => {
          const slots = await getSlotsByWeek(weekId, db);
          const existing = slots.find(
            (slot) => slot.day === day && slot.mealType === 'dinner' && slot.pinned
          );
          const text = freeText?.trim() || null;
          if (recipeId === null && text === null) {
            if (existing) {
              await deleteSlotRow(existing.id, db);
            }
            return;
          }
          const kind = recipeId !== null ? 'recipe' : 'free_text';
          const resolvedText = recipeId !== null ? null : text;
          if (existing) {
            await updateSlotRow(
              existing.id,
              {
                day,
                mealType: 'dinner',
                kind,
                recipeId,
                freeText: resolvedText,
                servings,
                note: null,
                pinned: true,
                sortOrder: existing.sortOrder,
              },
              db
            );
            return;
          }
          await createSlotRow(
            {
              weekId,
              day,
              mealType: 'dinner',
              kind,
              recipeId,
              freeText: resolvedText,
              servings,
              note: null,
              pinned: true,
              sortOrder: slots.length,
            },
            db
          );
        });
      },
      createSlot: async (input) => withDb((db) => createSlotRow(input, db)),
      updateSlot: async (id, input) => withDb((db) => updateSlotRow(id, input, db)),
      deleteSlot: async (id) => withDb((db) => deleteSlotRow(id, db)),
      setSlotRating: async (id, rating) => withDb((db) => setSlotRatingRow(id, rating, db)),
      setWeekStatus: async (weekId, status) => withDb((db) => setWeekStatusRow(weekId, status, db)),
      applyPlanInstruction: async (weekId, instruction) => apply(weekId, instruction, 'plan_edit'),
      createRecipesFromText: async (transcript) => {
        const ai = requireProvider();
        const db = await getDatabase();
        try {
          const result = await runRecipeExtraction(ai, transcript);
          await recordSuccess(db, null, 'recipe_extract', result.meta);
          const recipeIds = await withDb(async (database) => {
            const workspace = await loadWorkspace(database);
            const ids: number[] = [];
            for (const recipe of result.value.recipes) {
              ids.push(await createAgentRecipe(database, recipe, workspace));
            }
            return ids;
          });
          await refresh();
          void notifyPlanUpdated(result.value.message);
          return { message: result.value.message, recipeIds };
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : 'The AI request failed';
          await recordFailure(db, null, 'recipe_extract', message);
          await refresh();
          throw caught;
        }
      },
      importNewspaperText: async (transcript) => {
        const ai = requireProvider();
        const db = await getDatabase();
        try {
          const context = await dictationContext(db);
          const result = await runNewspaperExtraction(ai, transcript, context);
          await recordSuccess(db, null, 'newspaper', result.meta);
          const applied = await withDb(async (database) => {
            const [allStores, workspace, allIngredients, allAliases] = await Promise.all([
              getAllStores(database),
              loadWorkspace(database),
              getAllIngredients(database),
              getAllIngredientAliases(database),
            ]);
            const matcherIngredients = allIngredients.map((ingredient) => ({
              id: ingredient.id,
              name: ingredient.name,
              aliases: allAliases
                .filter((alias) => alias.ingredientId === ingredient.id)
                .map((alias) => alias.alias),
            }));
            const week = await ensureWeek(weekStart(todayDate()), database);
            let dealCount = 0;
            for (const deal of result.value.deals) {
              const store =
                allStores.find(
                  (candidate) => candidate.name.toLowerCase() === deal.storeName.toLowerCase()
                ) ?? allStores[0];
              if (!store) {
                continue;
              }
              const dealId = await createDealRow(
                {
                  storeId: store.id,
                  productName: deal.productName,
                  brand: null,
                  priceCents: deal.priceCents,
                  currency: deal.currency ?? settings.currency,
                  referencePriceCents: deal.referencePriceCents,
                  unit: null,
                  quantityText: deal.quantityText,
                  validFrom: deal.validFrom,
                  validTo: deal.validTo,
                  sourceUrl: null,
                  scrapedAt: isoNow(),
                  rawText: deal.rawText,
                },
                database
              );
              for (const match of matchIngredients(deal.productName, matcherIngredients).slice(0, 3)) {
                await ensureDealMatch(
                  { dealId, ingredientId: match.ingredientId, confidence: match.confidence },
                  database
                );
              }
              dealCount += 1;
            }
            let shoppingItemCount = 0;
            for (const item of result.value.shoppingItems) {
              const homeId = resolveHomeId(homes, defaultHome, item.homeName);
              await createManualItem(database, week.id, item, homeId, item.saleOnly);
              shoppingItemCount += 1;
            }
            const recipeIds: number[] = [];
            for (const recipe of result.value.recipes) {
              recipeIds.push(await createAgentRecipe(database, recipe, workspace));
            }
            return { dealCount, shoppingItemCount, recipeIds };
          });
          await refresh();
          void notifyPlanUpdated(result.value.message);
          return { message: result.value.message, ...applied };
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : 'The AI request failed';
          await recordFailure(db, null, 'newspaper', message);
          await refresh();
          throw caught;
        }
      },
      addWishRecipeIngredients: async (recipeId, homeId) => {
        const added = await withDb(async (db) => {
          const week = await ensureWeek(weekStart(todayDate()), db);
          return addWishRecipeLines(db, week.id, recipeId, homeId);
        });
        await refresh();
        return added;
      },
      regenerateShoppingList: async (weekId) =>
        withDb((db) =>
          regenerateList(
            db,
            weekId,
            recipes,
            recipeIngredients,
            ingredients,
            pantryItems,
            deals,
            dealMatches,
            settings.currency,
            defaultHome?.id ?? null
          )
        ),
      loadShoppingItems: async (weekId) => withDb((db) => getShoppingItems(weekId, db)),
      setShoppingItemChecked: async (id, checked) =>
        withDb((db) => setShoppingItemChecked(id, checked, db)),
      addManualShoppingItem: async (weekId, input) =>
        withDb((db) =>
          createShoppingItem(
            {
              weekId,
              homeId: input.homeId,
              ingredientId: null,
              label: input.label,
              category: input.category,
              quantity: input.quantity,
              unit: input.unit,
              checked: false,
              manual: true,
              saleOnly: input.saleOnly,
              dealId: null,
              priceCents: null,
              sortOrder: 0,
            },
            db
          )
        ),
      removeShoppingItem: async (id) => {
        await withDb((db) =>
          db.runAsync(
            `UPDATE shopping_items
                SET deleted = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
              WHERE id = ?`,
            [id]
          )
        );
      },
    };
  }, [
    ready,
    error,
    settings,
    aiState,
    preferences,
    ingredients,
    recipes,
    recipeIngredients,
    recipeSteps,
    recipeTags,
    recipeHistory,
    homes,
    defaultHome,
    pantryItems,
    stores,
    deals,
    dealMatches,
    aiRuns,
    refreshingDeals,
    lastDealRefresh,
    refresh,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData(): AppData {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useAppData must be used within a DataProvider');
  }
  return context;
}

interface AgentContextInput {
  weekStartDate: string;
  budgets: readonly WeekDayBudget[];
  slots: readonly Slot[];
  homes: readonly Home[];
  defaultHome: Home | null;
  stores: readonly Store[];
  recipes: readonly Recipe[];
  recipeIngredients: readonly RecipeIngredient[];
  ingredients: readonly Ingredient[];
  pantryItems: readonly PantryItem[];
  deals: readonly Deal[];
  dealMatches: readonly DealMatch[];
  preferences: Preferences;
}

function buildAgentContext(input: AgentContextInput): PlanEditContext {
  const today = todayDate();
  const homeById = new Map(input.homes.map((home) => [home.id, home]));
  const defaultHomeId = input.defaultHome?.id ?? input.homes[0]?.id ?? null;
  const ingredientById = new Map(input.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const recipeById = new Map(input.recipes.map((recipe) => [recipe.id, recipe]));
  const namesByRecipe = buildIngredientNamesByRecipe(input.recipeIngredients, input.ingredients);
  const storeById = new Map(input.stores.map((store) => [store.id, store]));
  const deals = input.deals
    .filter((deal) => isDealActive(deal, today))
    .map((deal) => {
      const ingredientNames = input.dealMatches
        .filter((match) => match.dealId === deal.id && match.status !== 'rejected')
        .map((match) => ingredientById.get(match.ingredientId)?.name)
        .filter((name): name is string => name !== undefined);
      return {
        storeName: storeById.get(deal.storeId)?.name ?? 'Store',
        productName: deal.productName,
        priceCents: deal.priceCents,
        referencePriceCents: deal.referencePriceCents,
        validTo: deal.validTo,
        ingredientNames,
      };
    })
    .filter((deal) => deal.ingredientNames.length > 0)
    .slice(0, 80);
  return {
    today,
    weekStart: input.weekStartDate,
    weeklyBudgetCents: input.preferences.weeklyBudgetCents > 0 ? input.preferences.weeklyBudgetCents : null,
    homes: input.homes.map((home) => ({ id: home.id, name: home.name })),
    days: input.budgets.map((budget) => ({
      day: budget.day,
      mode: budget.mode,
      cookMinutes: budget.cookMinutes,
      servings: budget.servings ?? input.preferences.defaultServings,
      homeName: homeById.get(budget.homeId ?? defaultHomeId)?.name ?? null,
    })),
    slots: input.slots.map((slot) => ({
      day: slot.day,
      mealType: slot.mealType,
      kind: slot.kind,
      recipeId: slot.recipeId,
      recipeName: slot.recipeId !== null ? recipeById.get(slot.recipeId)?.name ?? null : null,
      freeText: slot.freeText,
      servings: slot.servings,
      pinned: slot.pinned,
      cookedAt: slot.cookedAt,
    })),
    recipes: input.recipes
      .filter((recipe) => !recipe.isWish)
      .map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        minutes: recipe.prepMinutes + recipe.cookMinutes,
        category: recipe.category,
        tags: [],
        isWish: recipe.isWish,
        ingredients: namesByRecipe.get(recipe.id) ?? [],
      })),
    pantry: input.pantryItems.map((item) => ({
      ingredientId: item.ingredientId,
      name: ingredientById.get(item.ingredientId)?.name ?? 'Ingredient',
      homeName: homeById.get(item.homeId)?.name ?? 'Home',
      level: item.level,
      quantity: item.quantity,
      unit: item.unit,
      expiresOn: item.expiresOn,
    })),
    deals,
    allergies: input.preferences.allergies,
    diet: input.preferences.diet,
    dislikes: input.preferences.dislikes,
    avoidIngredients: [],
  };
}

interface Workspace {
  recipes: { id: number; name: string; servings: number; isWish: boolean }[];
  ingredientIdsByName: Map<string, number>;
}

async function loadWorkspace(db: SQLiteDatabase): Promise<Workspace> {
  const [recipes, ingredients] = await Promise.all([getAllRecipes(db), getAllIngredients(db)]);
  return {
    recipes: recipes.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      servings: recipe.servings,
      isWish: recipe.isWish,
    })),
    ingredientIdsByName: new Map(
      ingredients.map((ingredient) => [ingredient.name.trim().toLowerCase(), ingredient.id])
    ),
  };
}

async function createAgentRecipe(
  db: SQLiteDatabase,
  recipe: AgentRecipe,
  workspace: Workspace
): Promise<number> {
  const existing = workspace.recipes.find(
    (candidate) => candidate.name.trim().toLowerCase() === recipe.name.trim().toLowerCase()
  );
  if (existing) {
    return existing.id;
  }
  const id = await createRecipe(
    {
      name: recipe.name,
      description: recipe.description,
      category: recipe.category,
      source: 'ai',
      isBuiltin: false,
      isFavorite: false,
      isWish: recipe.isWish,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      notes: null,
    },
    db
  );
  workspace.recipes.push({
    id,
    name: recipe.name,
    servings: recipe.servings,
    isWish: recipe.isWish,
  });
  let order = 0;
  for (const ingredient of recipe.ingredients) {
    const key = ingredient.name.trim().toLowerCase();
    let ingredientId = workspace.ingredientIdsByName.get(key);
    if (ingredientId === undefined) {
      ingredientId = await createIngredient(
        {
          name: ingredient.name,
          category: ingredient.category,
          defaultUnit: ingredient.unit,
          defaultQuantity: ingredient.quantity,
          isPantryStaple: false,
          shelfLifeDays: ingredient.shelfLifeDays,
          notes: null,
        },
        db
      );
      workspace.ingredientIdsByName.set(key, ingredientId);
    }
    await createRecipeIngredient(
      {
        recipeId: id,
        ingredientId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        note: null,
        optional: ingredient.optional,
        sortOrder: order,
      },
      db
    );
    order += 1;
  }
  let stepIndex = 0;
  for (const instruction of recipe.steps) {
    await createRecipeStep(
      { recipeId: id, stepIndex, instruction, durationMinutes: null },
      db
    );
    stepIndex += 1;
  }
  for (const tag of recipe.tags) {
    await addRecipeTag(id, tag, db);
  }
  return id;
}

function resolveHomeId(
  homes: readonly Home[],
  defaultHome: Home | null,
  name: string | null
): number {
  if (name !== null) {
    const normalized = name.trim().toLowerCase();
    const match = homes.find((home) => home.name.trim().toLowerCase() === normalized);
    if (match) {
      return match.id;
    }
  }
  return defaultHome?.id ?? homes[0]?.id ?? 1;
}

async function ensureHomeId(db: SQLiteDatabase, name: string): Promise<number> {
  const homes = await getAllHomes(db);
  const normalized = name.trim().toLowerCase();
  const match = homes.find((home) => home.name.trim().toLowerCase() === normalized);
  if (match) {
    return match.id;
  }
  return createHomeRow({ name: name.trim() }, db);
}

interface ApplyOptions {
  preferences: Preferences;
  settings: Settings;
}

async function applyPlanActions(
  db: SQLiteDatabase,
  weekId: number,
  actions: readonly PlanEditAction[],
  options: ApplyOptions
): Promise<Set<WeekDay>> {
  const changedDays = new Set<WeekDay>();
  const workspace = await loadWorkspace(db);
  const homes = await getAllHomes(db);
  const defaultHome = homes[0] ?? null;
  await ensureWeek(todayDate(), db);
  for (const action of actions) {
    if (action.type === 'set_slot') {
      const slots = await getSlotsByWeek(weekId, db);
      const existing = slots.find(
        (slot) => slot.day === action.day && slot.mealType === action.mealType
      );
      const recipeId =
        action.recipeId !== null
          ? workspace.recipes.find((recipe) => recipe.id === action.recipeId)?.id ?? null
          : action.recipeName !== null
            ? workspace.recipes.find(
                (recipe) =>
                  recipe.name.trim().toLowerCase() === action.recipeName?.trim().toLowerCase()
              )?.id ?? null
            : null;
      const freeText =
        recipeId === null
          ? action.freeText ?? action.recipeName
          : null;
      if (recipeId === null && freeText === null) {
        continue;
      }
      if (existing?.pinned) {
        continue;
      }
      const kind = recipeId !== null ? 'recipe' : 'free_text';
      const budget = (await getWeekDayBudgets(weekId, db)).find((row) => row.day === action.day);
      const servings =
        action.servings ?? budget?.servings ?? options.preferences.defaultServings;
      if (existing) {
        await updateSlotRow(
          existing.id,
          {
            day: existing.day,
            mealType: existing.mealType,
            kind,
            recipeId,
            freeText,
            servings,
            note: existing.note,
            pinned: existing.pinned,
            sortOrder: existing.sortOrder,
          },
          db
        );
      } else {
        await createSlotRow(
          {
            weekId,
            day: action.day,
            mealType: action.mealType,
            kind,
            recipeId,
            freeText,
            servings,
            note: null,
            sortOrder: slots.length,
          },
          db
        );
      }
      changedDays.add(action.day);
      continue;
    }
    if (action.type === 'clear_slot') {
      const slots = await getSlotsByWeek(weekId, db);
      const existing = slots.find(
        (slot) => slot.day === action.day && slot.mealType === action.mealType
      );
      if (existing && !existing.pinned) {
        await deleteSlotRow(existing.id, db);
        changedDays.add(action.day);
      }
      continue;
    }
    if (action.type === 'set_day') {
      const budgets = await getWeekDayBudgets(weekId, db);
      const current = budgets.find((row) => row.day === action.day);
      const homeId =
        action.homeName !== null ? await ensureHomeId(db, action.homeName) : current?.homeId ?? null;
      await upsertWeekDayBudget(
        {
          weekId,
          day: action.day,
          mode: action.mode ?? current?.mode ?? 'cook',
          cookMinutes: action.cookMinutes ?? current?.cookMinutes ?? 45,
          servings: action.servings ?? current?.servings ?? options.preferences.defaultServings,
          homeId,
        },
        db
      );
      changedDays.add(action.day);
      continue;
    }
    if (action.type === 'set_home_days') {
      const homeId = await ensureHomeId(db, action.homeName);
      for (const day of action.days) {
        await setWeekDayHomeRow(weekId, day, homeId, db);
        changedDays.add(day);
      }
      continue;
    }
    if (action.type === 'mark_cooked') {
      const slots = await getSlotsByWeek(weekId, db);
      const existing = slots.find(
        (slot) => slot.day === action.day && slot.mealType === action.mealType
      );
      if (existing) {
        await markSlotCookedRow(existing.id, action.actual, db);
        changedDays.add(action.day);
      }
      continue;
    }
    if (action.type === 'replan') {
      await replanDays(db, weekId, action.days, options, changedDays);
      continue;
    }
    if (action.type === 'create_recipe') {
      const recipeId = await createAgentRecipe(db, action.recipe, workspace);
      if (action.scheduleDay !== null) {
        const slots = await getSlotsByWeek(weekId, db);
        const existing = slots.find(
          (slot) => slot.day === action.scheduleDay && slot.mealType === action.mealType
        );
        const budget = (await getWeekDayBudgets(weekId, db)).find(
          (row) => row.day === action.scheduleDay
        );
        const servings = budget?.servings ?? options.preferences.defaultServings;
        if (existing?.pinned) {
          changedDays.add(action.scheduleDay);
          continue;
        }
        if (existing) {
          await updateSlotRow(
            existing.id,
            {
              day: existing.day,
              mealType: existing.mealType,
              kind: 'recipe',
              recipeId,
              freeText: null,
              servings,
              note: existing.note,
              pinned: existing.pinned,
              sortOrder: existing.sortOrder,
            },
            db
          );
        } else {
          await createSlotRow(
            {
              weekId,
              day: action.scheduleDay,
              mealType: action.mealType,
              kind: 'recipe',
              recipeId,
              freeText: null,
              servings,
              note: null,
              sortOrder: slots.length,
            },
            db
          );
        }
        changedDays.add(action.scheduleDay);
      } else if (action.recipe.isWish) {
        await addWishRecipeLines(db, weekId, recipeId, resolveHomeId(homes, defaultHome, null));
      }
      continue;
    }
    if (action.type === 'make_wish_recipe') {
      const recipe = workspace.recipes.find(
        (candidate) =>
          candidate.name.trim().toLowerCase() === action.recipeName.trim().toLowerCase()
      );
      if (!recipe) {
        continue;
      }
      const homeId = resolveHomeId(homes, defaultHome, action.homeName);
      await addWishRecipeLines(db, weekId, recipe.id, homeId);
      continue;
    }
    if (action.type === 'add_shopping_item') {
      const homeId = resolveHomeId(homes, defaultHome, action.homeName);
      await createManualItem(db, weekId, action, homeId, action.saleOnly);
      continue;
    }
    if (action.type === 'add_home') {
      await ensureHomeId(db, action.name);
    }
  }
  await regenerateList(
    db,
    weekId,
    await getAllRecipes(db),
    await getAllRecipeIngredients(db),
    await getAllIngredients(db),
    await getAllPantryItems(db),
    await getAllDeals(db),
    await getAllDealMatches(db),
    options.settings.currency,
    defaultHome?.id ?? null
  );
  return changedDays;
}

async function replanDays(
  db: SQLiteDatabase,
  weekId: number,
  days: readonly WeekDay[],
  options: ApplyOptions,
  changedDays: Set<WeekDay>
): Promise<void> {
  const [recipes, recipeIngredients, ingredients, tags, pantry, deals, matches, history, budgets] =
    await Promise.all([
      getAllRecipes(db),
      getAllRecipeIngredients(db),
      getAllIngredients(db),
      getAllRecipeTags(db),
      getAllPantryItems(db),
      getAllDeals(db),
      getAllDealMatches(db),
      getRecipeHistory(db),
      getWeekDayBudgets(weekId, db),
    ]);
  const today = todayDate();
  const activeDeals = new Set(deals.filter((deal) => isDealActive(deal, today)).map((deal) => deal.id));
  const stocked = new Set(
    pantry.filter((item) => item.level === 'stocked').map((item) => item.ingredientId)
  );
  const onOffer = new Set(
    matches
      .filter((match) => match.status !== 'rejected' && activeDeals.has(match.dealId))
      .map((match) => match.ingredientId)
  );
  const summaries = buildRecipeSummaries(recipes.filter((recipe) => !recipe.isWish), tags);
  const plannerRecipes: PlannerRecipe[] = filterRecipesForPreferences(
    buildPlannerRecipes(
      summaries,
      buildIngredientNamesByRecipe(recipeIngredients, ingredients),
      options.preferences.defaultServings,
      {
        factsByRecipe: buildIngredientFactsByRecipe(recipeIngredients, ingredients),
        stockedIngredientIds: stocked,
        onOfferIngredientIds: onOffer,
      }
    ),
    {
      diet: options.preferences.diet,
      allergies: options.preferences.allergies,
      dislikes: options.preferences.dislikes,
    }
  );
  const slots = await getSlotsByWeek(weekId, db);
  const usedRecipeIds = new Set(
    slots
      .filter((slot) => slot.recipeId !== null && !days.includes(slot.day))
      .map((slot) => slot.recipeId as number)
  );
  for (const day of days) {
    const budget = budgets.find((row) => row.day === day);
    const mode = budget?.mode ?? 'cook';
    if (mode !== 'cook') {
      continue;
    }
    const homeId = budget?.homeId ?? null;
    const expired = expiringIngredientIds(
      pantry.filter((item) => homeId === null || item.homeId === homeId),
      today
    );
    const proposed = planGap(
      {
        day,
        mode,
        cookMinutes: budget?.cookMinutes ?? 45,
        servings: budget?.servings ?? options.preferences.defaultServings,
        homeId,
        expiringIngredientIds: expired,
      },
      plannerRecipes,
      {
        defaultServings: options.preferences.defaultServings,
        history,
        excludeRecipeIds: [...usedRecipeIds],
      }
    );
    const existing = slots.find((slot) => slot.day === day && slot.mealType === 'dinner');
    if (existing?.pinned) {
      continue;
    }
    if (existing) {
      await deleteSlotRow(existing.id, db);
    }
    await createSlotRow(
      {
        weekId,
        day,
        mealType: 'dinner',
        kind: proposed.kind,
        recipeId: proposed.recipeId,
        freeText: proposed.freeText,
        servings: proposed.servings,
        note: null,
        sortOrder: slots.length,
      },
      db
    );
    if (proposed.recipeId !== null) {
      usedRecipeIds.add(proposed.recipeId);
    }
    changedDays.add(day);
  }
}

async function addWishRecipeLines(
  db: SQLiteDatabase,
  weekId: number,
  recipeId: number,
  homeId: number
): Promise<number> {
  const [recipeIngredients, ingredients, pantry] = await Promise.all([
    getAllRecipeIngredients(db),
    getAllIngredients(db),
    getAllPantryItems(db),
  ]);
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const lines = wishRecipeShoppingLines(
    recipeIngredients
      .filter((row) => row.recipeId === recipeId)
      .map((row) => {
        const ingredient = ingredientById.get(row.ingredientId);
        return {
          ingredientId: row.ingredientId,
          name: ingredient?.name ?? 'Ingredient',
          category: ingredient?.category ?? ('other' as const),
          quantity: row.quantity,
          unit: row.unit,
          optional: row.optional,
        };
      }),
    pantry
      .filter((item) => item.homeId === homeId)
      .map((item) => ({
        ingredientId: item.ingredientId,
        homeId: item.homeId,
        level: item.level,
        quantity: item.quantity,
        unit: item.unit,
      }))
  );
  let added = 0;
  for (const line of lines) {
    await createShoppingItem(
      {
        weekId,
        homeId,
        ingredientId: line.ingredientId,
        label: line.label,
        category: line.category,
        quantity: line.quantity,
        unit: line.unit,
        checked: false,
        manual: true,
        saleOnly: true,
        dealId: null,
        priceCents: null,
        sortOrder: 0,
      },
      db
    );
    added += 1;
  }
  return added;
}

async function createManualItem(
  db: SQLiteDatabase,
  weekId: number,
  item: AgentShoppingItem,
  homeId: number,
  saleOnly: boolean
): Promise<void> {
  await createShoppingItem(
    {
      weekId,
      homeId,
      ingredientId: null,
      label: item.label,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      checked: false,
      manual: true,
      saleOnly,
      dealId: null,
      priceCents: null,
      sortOrder: 0,
    },
    db
  );
}

async function regenerateList(
  db: SQLiteDatabase,
  weekId: number,
  recipes: readonly Recipe[],
  recipeIngredients: readonly RecipeIngredient[],
  ingredients: readonly Ingredient[],
  pantryItems: readonly PantryItem[],
  deals: readonly Deal[],
  dealMatches: readonly DealMatch[],
  currency: Currency,
  defaultHomeId: number | null
): Promise<ShoppingItem[]> {
  const slots = await getSlotsByWeek(weekId, db);
  const budgets = await getWeekDayBudgets(weekId, db);
  const homeByDay = new Map(budgets.map((budget) => [budget.day, budget.homeId]));
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

  const meals: PlannedMeal[] = [];
  for (const slot of slots) {
    if (slot.kind !== 'recipe' || slot.recipeId === null) {
      continue;
    }
    const recipe = recipeById.get(slot.recipeId);
    meals.push({
      slotId: slot.id,
      homeId: homeByDay.get(slot.day) ?? defaultHomeId,
      servings: slot.servings,
      recipeServings: recipe?.servings ?? slot.servings,
      ingredients: recipeIngredients
        .filter((row) => row.recipeId === slot.recipeId)
        .map((row) => {
          const ingredient = ingredientById.get(row.ingredientId);
          return {
            ingredientId: row.ingredientId,
            name: ingredient?.name ?? 'Ingredient',
            category: ingredient?.category ?? 'other',
            quantity: row.quantity,
            unit: row.unit,
          };
        }),
    });
  }

  const today = todayDate();
  const bestDeals = new Map<number, IngredientDeal>();
  const wanted = new Set<number>();
  for (const meal of meals) {
    for (const ingredient of meal.ingredients) {
      wanted.add(ingredient.ingredientId);
    }
  }
  for (const ingredientId of wanted) {
    const best = bestDealForIngredient(ingredientId, deals, dealMatches, today, currency);
    if (best) {
      bestDeals.set(ingredientId, best);
    }
  }

  const list = buildShoppingList({ meals, pantryItems, bestDeals });
  await replaceGeneratedShoppingItems(
    weekId,
    list.lines.map((line, index) => ({
      weekId,
      homeId: line.homeId,
      ingredientId: line.ingredientId,
      label: line.label,
      category: line.category,
      quantity: line.quantity,
      unit: line.unit,
      checked: false,
      manual: false,
      saleOnly: false,
      dealId: line.dealId,
      priceCents: line.priceCents,
      sortOrder: index,
    })),
    db
  );
  return getShoppingItems(weekId, db);
}
