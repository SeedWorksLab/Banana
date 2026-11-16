import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import RecipeDetailScreen from '../../src/app/recipe/[id]';
import { lightTheme } from '../../src/theme';

jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ id: '1' }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('../../src/data/DataProvider', () => ({
  useAppData: () => ({
    recipes: [{ id: 1, name: 'Toast', category: 'breakfast', servings: 2, prepMinutes: 2, cookMinutes: 3 }],
    recipeIngredients: [], recipeTags: [], ingredients: [], pantryItems: [], defaultHome: null,
    recipeSteps: [{ id: 1, recipeId: 1, stepIndex: 0, instruction: 'Toast the bread.' }],
  }),
}));

it('shows cooking steps on opening and lets the user hide and reopen them', async () => {
  await render(<PaperProvider theme={lightTheme}><RecipeDetailScreen /></PaperProvider>);
  expect(screen.getByText('1. Toast the bread.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Hide recipe steps' }));
  expect(screen.queryByText('1. Toast the bread.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Show recipe steps' }));
  expect(screen.getByText('1. Toast the bread.')).toBeTruthy();
});
