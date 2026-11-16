import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import RecipeEditorScreen from '../../src/app/recipe/new';
import { lightTheme } from '../../src/theme';

const mockSave = jest.fn(async () => {});
const mockTags = jest.fn(async () => {});
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ id: '1' }),
  useRouter: () => ({ canGoBack: () => false }),
}));
jest.mock('../../src/data/DataProvider', () => ({
  useAppData: () => ({
    recipes: [{ id: 1, name: 'Pizza place', category: 'dinner', servings: 2, prepMinutes: 10, cookMinutes: 20 }],
    recipeIngredients: [], recipeSteps: [], recipeTags: [], ingredients: [],
    saveRecipe: mockSave, replaceRecipeTags: mockTags,
    replaceRecipeIngredients: jest.fn(async () => {}), replaceRecipeSteps: jest.fn(async () => {}),
  }),
}));

it('saves multiple meal tags and the eating-out tag on the same recipe', async () => {
  await render(<PaperProvider theme={lightTheme}><RecipeEditorScreen /></PaperProvider>);
  await fireEvent.press(screen.getByTestId('recipe-meal-breakfast'));
  await fireEvent.press(screen.getByTestId('recipe-meal-lunch'));
  await fireEvent(screen.getByTestId('recipe-eating-out'), 'valueChange', true);
  await fireEvent.press(screen.getByText('Save recipe'));
  expect(mockSave).toHaveBeenCalledWith(1, expect.objectContaining({ prepMinutes: 0, cookMinutes: 0 }));
  expect(mockTags).toHaveBeenCalledWith(1, ['dinner', 'breakfast', 'lunch', 'eating_out']);
});
