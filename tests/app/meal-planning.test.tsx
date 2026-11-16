import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import PlanScreen from '../../src/app/(tabs)/index';
import { lightTheme } from '../../src/theme';
import { DEFAULT_SETTINGS as mockSettings } from '../../src/database/settings';
import { DEFAULT_PREFERENCES as mockPreferences } from '../../src/database/preferences';
import * as dateUtils from '../../src/utils/date';

afterEach(() => jest.restoreAllMocks());

const mockMeal = jest.fn(async () => {});
const mockWish = jest.fn(async () => {});
const mockLoad = jest.fn(async () => ({
  week: { id: 1, weekStartDate: '2026-11-16' }, slots: [], budgets: [], shoppingItems: [],
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
    recipes: [], recipeIngredients: [], recipeTags: [], recipeHistory: [], ingredients: [],
    pantryItems: [], homes: [{ id: 1, name: 'Home' }], defaultHome: { id: 1 },
    deals: [], dealMatches: [], loadWeekPlan: mockLoad, planWeekMeals: mockPlan,
    setMealBudget: mockMeal, setDayWish: mockWish,
  }),
}));

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
