import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  AiRun,
  AiState,
  Currency,
  Deal,
  DealMatch,
  DayMode,
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
import { getAllPantryItems, setPantryLevel, deletePantryItem } from '../database/pantry';
import { getAllStores, setStoreEnabled, setStoreOffersUrl } from '../database/stores';
import { getAllDeals } from '../database/deals';
import { getAllDealMatches, setDealMatchStatus } from '../database/dealMatches';
import { createAiRun, getAiRuns } from '../database/aiRuns';
import {
  createSlot as createSlotRow,
  deleteSlot as deleteSlotRow,
  getSlotsByWeek,
  getRecipeHistory,
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
import { getWeekDayBudgets, upsertWeekDayBudget } from '../database/weekDayBudgets';
import { ensureWeek, setWeekStatus as setWeekStatusRow } from '../database/weeks';
import { todayDate } from '../utils/date';
import { buildShoppingList, type PlannedMeal } from '../services/shopping-list-service';
import type { RatingEntry } from '../services/recipe-service';
import { matchTicketLines, parseTicketText } from '../services/ticket-service';
import { bestDealForIngredient, type IngredientDeal } from '../services/deal-service';
import { refreshDeals as refreshDealsFromStores, type DealRefreshStoreResult } from '../deals';

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
  setPantryLevel: (ingredientId: number, level: PantryLevel) => Promise<void>;
  importTicket: (text: string) => Promise<{
    matched: { ingredientId: number; name: string; line: string }[];
    unmatched: string[];
  }>;
  removePantryItem: (ingredientId: number) => Promise<void>;
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
    servings: number | null
  ) => Promise<void>;
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
      setPantryLevel: async (ingredientId, level) => {
        await withDb((db) => setPantryLevel(ingredientId, level, db));
        await refresh();
      },
      importTicket: async (text) => {
        const lines = parseTicketText(text);
        const matches = matchTicketLines(lines, ingredients);
        const matched = matches.filter(
          (match): match is typeof match & { ingredientId: number; ingredientName: string } =>
            match.ingredientId !== null && match.ingredientName !== null
        );
        await withDb(async (db) => {
          for (const match of matched) {
            await setPantryLevel(match.ingredientId, 'stocked', db);
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
      removePantryItem: async (ingredientId) => {
        await withDb((db) => deletePantryItem(ingredientId, db));
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
      setDayBudget: async (weekId, day, mode, cookMinutes, servings) => {
        await withDb(async (db) => {
          await upsertWeekDayBudget({ weekId, day, mode, cookMinutes, servings }, db);
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
      createSlot: async (input) => withDb((db) => createSlotRow(input, db)),      updateSlot: async (id, input) => withDb((db) => updateSlotRow(id, input, db)),
      deleteSlot: async (id) => withDb((db) => deleteSlotRow(id, db)),
      setSlotRating: async (id, rating) => withDb((db) => setSlotRatingRow(id, rating, db)),
      setWeekStatus: async (weekId, status) => withDb((db) => setWeekStatusRow(weekId, status, db)),
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
            settings.currency
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
              ingredientId: null,
              label: input.label,
              category: input.category,
              quantity: input.quantity,
              unit: input.unit,
              checked: false,
              manual: true,
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

async function regenerateList(
  db: SQLiteDatabase,
  weekId: number,
  recipes: readonly Recipe[],
  recipeIngredients: readonly RecipeIngredient[],
  ingredients: readonly Ingredient[],
  pantryItems: readonly PantryItem[],
  deals: readonly Deal[],
  dealMatches: readonly DealMatch[],
  currency: Currency
): Promise<ShoppingItem[]> {
  const slots = await getSlotsByWeek(weekId, db);
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
      ingredientId: line.ingredientId,
      label: line.label,
      category: line.category,
      quantity: line.quantity,
      unit: line.unit,
      checked: false,
      manual: false,
      dealId: line.dealId,
      priceCents: line.priceCents,
      sortOrder: index,
    })),
    db
  );
  return getShoppingItems(weekId, db);
}
