import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import PlanScreen from '../../src/app/(tabs)/index';
import { lightTheme } from '../../src/theme';
import { DEFAULT_SETTINGS as mockSettings } from '../../src/database/settings';
import { DEFAULT_PREFERENCES as mockPreferences } from '../../src/database/preferences';
import * as dateUtils from '../../src/utils/date';
import type { Ingredient, Recipe, RecipeIngredient, Slot, WeekDayBudget } from '../../src/models';
import type { RecipeUse } from '../../src/models/recipe-use';
import { batchBudget, batchRecipe, batchSlot } from '../fixtures/batch-meals';

jest.setTimeout(20_000);

afterEach(() => jest.restoreAllMocks());

const mockMeal = jest.fn(async () => {});
const mockWish = jest.fn(async () => {});
const mockLeftovers = jest.fn(async () => {});
const mockSlots: Slot[] = [];
const mockBudgets: WeekDayBudget[] = [];
const mockRecipes: Recipe[] = [];
const mockIngredients: Pick<Ingredient, 'id' | 'name' | 'category'>[] = [];
const mockRecipeIngredients: Pick<RecipeIngredient, 'recipeId' | 'ingredientId' | 'quantity' | 'unit' | 'optional'>[] = [];
const mockRecentUses: RecipeUse[] = [];
const mockLoad = jest.fn(async () => ({
  week: { id: 1, weekStartDate: '2026-11-16' }, slots: mockSlots, budgets: mockBudgets, shoppingItems: [], recentRecipeUses: mockRecentUses,
}));
const mockPlan = jest.fn(async () => {});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(effect, [effect]);
  },
}));
jest.mock('../../src/data/DataProvider', () => ({
  useAppData: () => ({
    settings: mockSettings, preferences: mockPreferences,
    recipes: mockRecipes, recipeIngredients: mockRecipeIngredients, recipeTags: [], recipeHistory: [], ingredients: mockIngredients,
    pantryItems: [], homes: [{ id: 1, name: 'Home' }], defaultHome: { id: 1 },
    deals: [], dealMatches: [], loadWeekPlan: mockLoad, planWeekMeals: mockPlan,
    setMealBudget: mockMeal, setDayWish: mockWish, setMealLeftovers: mockLeftovers,
  }),
}));
jest.mock('react-native-paper', () => {
  const actual = jest.requireActual<typeof import('react-native-paper')>('react-native-paper');
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Menu = Object.assign(
    ({ visible, anchor, children }: { visible: boolean; anchor: React.ReactNode; children: React.ReactNode }) =>
      React.createElement(View, null, anchor, visible ? children : null),
    { Item: actual.Menu.Item },
  );
  return { ...actual, Menu };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(dateUtils, 'todayDate').mockReturnValue('2026-11-16');
  mockSlots.length = 0;
  mockBudgets.length = 0;
  mockRecipes.length = 0;
  mockIngredients.length = 0;
  mockRecipeIngredients.length = 0;
  mockRecentUses.length = 0;
});

it('does not recommend allergenic, inactive or placeholder wish recipes in discovery', async () => {
  jest.replaceProperty(mockPreferences, 'allergies', ['peanut']);
  mockRecipes.push(
    batchRecipe({ name: 'Peanut curry' }), batchRecipe({ id: 2, name: 'Safe soup' }),
    batchRecipe({ id: 3, name: 'Inactive dish', active: false }),
    batchRecipe({ id: 4, name: 'Wish placeholder', isWish: true }),
  );
  mockIngredients.push({ id: 1, name: 'Peanut', category: 'pantry' });
  mockRecipeIngredients.push({ recipeId: 1, ingredientId: 1, quantity: 100, unit: 'g', optional: false });
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  expect(await screen.findByLabelText('Open Safe soup')).toBeTruthy();
  for (const name of ['Peanut curry', 'Inactive dish', 'Wish placeholder']) {
    expect(screen.queryByLabelText(`Open ${name}`)).toBeNull();
  }
});

it('uses prior-week planned meals in the visible discovery recommendations', async () => {
  mockRecipes.push(batchRecipe({ name: 'A curry' }), batchRecipe({ id: 2, name: 'B soup' }));
  mockRecentUses.push({ recipeId: 1, weekStartDate: '2026-11-09', day: 'sun' });
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  await screen.findByTestId('day-card-mon');
  expect(screen.getAllByLabelText(/^Open /)[0].props.accessibilityLabel).toBe('Open B soup');
});

it('starts past days collapsed and keeps today and upcoming days expanded', async () => {
  jest.mocked(dateUtils.todayDate).mockReturnValue('2026-11-18');
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  expect(await screen.findByTestId('day-card-mon')).toBeTruthy();
  for (const day of ['mon', 'tue']) {
    expect(screen.getByTestId(`day-toggle-${day}`).props.accessibilityState.expanded).toBe(false);
    expect(screen.queryByTestId(`day-content-${day}`)).toBeNull();
    expect(screen.queryByTestId(`slot-dinner-${day}`)).toBeNull();
  }
  for (const day of ['wed', 'thu', 'fri', 'sat', 'sun']) {
    expect(screen.getByTestId(`day-toggle-${day}`).props.accessibilityState.expanded).toBe(true);
    expect(screen.getByTestId(`day-content-${day}`)).toBeTruthy();
  }
});

it('expands past days and collapses upcoming days using the header without changing meals', async () => {
  jest.mocked(dateUtils.todayDate).mockReturnValue('2026-11-18');
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Expand Monday' }));
  expect(screen.getByTestId('slot-dinner-mon')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Collapse Monday' }).props.accessibilityState.expanded).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Collapse Friday' }));
  expect(screen.queryByTestId('slot-dinner-fri')).toBeNull();
  expect(screen.getByRole('button', { name: 'Expand Friday' }).props.accessibilityState.expanded).toBe(false);
  expect(mockMeal).not.toHaveBeenCalled();
  expect(mockWish).not.toHaveBeenCalled();
  expect(mockPlan).not.toHaveBeenCalled();
});

it('remembers independent expansion choices by date when switching weeks', async () => {
  jest.mocked(dateUtils.todayDate).mockReturnValue('2026-11-18');
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Expand Monday' }));
  await fireEvent.press(screen.getByText('Next week'));
  expect(screen.getByRole('button', { name: 'Collapse Monday' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Collapse Monday' }));
  await fireEvent.press(screen.getByText('This week'));
  expect(screen.getByRole('button', { name: 'Collapse Monday' })).toBeTruthy();
  expect(screen.getByTestId('slot-dinner-mon')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next week'));
  expect(screen.getByRole('button', { name: 'Expand Monday' })).toBeTruthy();
  expect(screen.queryByTestId('slot-dinner-mon')).toBeNull();
});

it('keeps the day edit shortcut usable without expanding a collapsed card', async () => {
  jest.mocked(dateUtils.todayDate).mockReturnValue('2026-11-18');
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit Monday' }));
  expect(screen.getByRole('button', { name: 'Save meal settings' })).toBeTruthy();
  expect(screen.queryByTestId('day-content-mon')).toBeNull();
  expect(mockMeal).not.toHaveBeenCalled();
});

it('shows all three meals before planning and enables snacks only on explicit request', async () => {
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  expect(await screen.findByTestId('slot-breakfast-mon')).toBeTruthy();
  expect(screen.getByTestId('slot-lunch-mon')).toBeTruthy();
  expect(screen.getByTestId('slot-dinner-mon')).toBeTruthy();
  expect(screen.queryByTestId('slot-snack-mon')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Add snack on Monday' }));
  const toggle = screen.getByRole('switch', { name: 'Plan a snack' });
  expect(toggle.props.accessibilityState.checked).toBe(false);
  await fireEvent(toggle, 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Save meal settings' }));
  expect(mockMeal).toHaveBeenCalledWith(1, 'mon', expect.objectContaining({
    mealType: 'snack', enabled: true,
  }), mockPreferences.defaultServings, 1);
});

it('marks today in the current week without highlighting that weekday in next week', async () => {
  jest.spyOn(dateUtils, 'todayDate').mockReturnValue('2026-11-16');
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  expect(await screen.findByTestId('day-card-mon')).toBeTruthy();
  expect(screen.getAllByText('Today')).toHaveLength(1);
  expect(screen.getByTestId('slot-lunch-mon')).toBeTruthy();
  await fireEvent.press(screen.getByText('Next week'));
  expect(screen.queryByText('Today')).toBeNull();
});

it('shows the cooking total, reserved meals and the explicit leftover source on the plan', async () => {
  mockRecipes.push(batchRecipe());
  mockSlots.push(batchSlot({ servings: 4, pinned: true }), batchSlot({
    id: 2, uuid: 'leftover', day: 'fri', mealType: 'lunch', kind: 'leftovers',
    batchSourceUuid: 'meal-1', pinned: true,
  }));
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  expect(await screen.findByText('Cook 4 portions')).toBeTruthy();
  expect(screen.getByText('Eat 2 portions at this meal')).toBeTruthy();
  expect(screen.getByText('Keep 2 portions for Friday lunch')).toBeTruthy();
  expect(screen.getByText('Leftovers from Tuesday dinner')).toBeTruthy();
  expect(screen.getByText('Eat 2 portions · No cooking')).toBeTruthy();
});

it('lets a leftovers meal choose a specific earlier recipe without touching unrelated wish settings', async () => {
  mockRecipes.push(batchRecipe());
  mockSlots.push(batchSlot());
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  await fireEvent.press(await screen.findByTestId('slot-lunch-wed'));
  await fireEvent.press(screen.getByTestId('option-Meal mode'));
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Leftovers' }));
  await fireEvent.press(screen.getByTestId('option-Leftovers from'));
  await fireEvent.press(screen.getByText('Tuesday dinner · Curry'));
  await fireEvent.press(screen.getByRole('button', { name: 'Save meal settings' }));
  await waitFor(() => expect(mockLeftovers).toHaveBeenCalledWith(1, 'wed', 'lunch', 'meal-1', 2, 1));
  expect(mockMeal).not.toHaveBeenCalled();
  expect(mockWish).not.toHaveBeenCalled();
});

it('edits a linked leftover directly instead of redirecting to the cooking day', async () => {
  mockRecipes.push(batchRecipe());
  mockSlots.push(batchSlot({ servings: 4, pinned: true }), batchSlot({
    id: 2, uuid: 'leftover', day: 'wed', mealType: 'lunch', kind: 'leftovers',
    batchSourceUuid: 'meal-1', pinned: true,
  }));
  mockBudgets.push(batchBudget({ day: 'wed', mealSettings: [
    { mealType: 'lunch', mode: 'leftovers', cookMinutes: 0, enabled: true },
  ] }));
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  await fireEvent.press(await screen.findByTestId('slot-lunch-wed'));
  expect(screen.getByLabelText('Leftovers from: Tuesday dinner · Curry')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Portions to eat at this meal'), '1');
  await fireEvent.press(screen.getByRole('button', { name: 'Save meal settings' }));
  await waitFor(() => expect(mockLeftovers).toHaveBeenCalledWith(1, 'wed', 'lunch', 'meal-1', 1, 1));
});

it('keeps existing reservations explicit when editing the cooking-day portions', async () => {
  mockRecipes.push(batchRecipe());
  mockSlots.push(batchSlot({ servings: 5, pinned: true }), batchSlot({
    id: 2, uuid: 'leftover', day: 'fri', mealType: 'lunch', kind: 'leftovers',
    servings: 3, batchSourceUuid: 'meal-1', pinned: true,
  }));
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  await fireEvent.press(await screen.findByTestId('slot-dinner-tue'));
  expect(screen.getByLabelText('Portions to eat at this meal').props.value).toBe('2');
  expect(screen.queryByTestId('option-Reserve consecutive leftover meals')).toBeNull();
  expect(screen.queryByTestId('option-Food wish')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Portions to eat at this meal'), '1');
  await fireEvent.press(screen.getByRole('button', { name: 'Save meal settings' }));
  await waitFor(() => expect(mockWish).toHaveBeenCalledWith(1, 'tue', 1, null, 1, 'dinner'));
});

it('requires a source instead of silently inventing an unlinked leftover meal', async () => {
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><PlanScreen /></PaperProvider>);
  await fireEvent.press(await screen.findByTestId('slot-lunch-wed'));
  await fireEvent.press(screen.getByTestId('option-Meal mode'));
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Leftovers' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save meal settings' }));
  expect(await screen.findByText('Choose which earlier meal these leftovers come from.')).toBeTruthy();
  expect(mockLeftovers).not.toHaveBeenCalled();
  expect(mockMeal).not.toHaveBeenCalled();
});
