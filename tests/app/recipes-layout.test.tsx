import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import RecipesScreen from '../../src/app/(tabs)/recipes';
import { lightTheme } from '../../src/theme';
import type { Recipe } from '../../src/models';

let mockRecipes: Partial<Recipe>[] = [];
beforeEach(() => { mockRecipes = []; });
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(), useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('../../src/data/DataProvider', () => ({
  useAppData: () => ({ settings: { language: 'en' }, recipes: mockRecipes, recipeTags: [] }),
}));

it('keeps the filter strip content-sized whether the recipe list is empty or populated', async () => {
  const view = await render(<PaperProvider theme={lightTheme}><RecipesScreen /></PaperProvider>);
  const strip = () => view.getByTestId('recipe-filters');
  const emptyStyle = StyleSheet.flatten(strip()!.props.style);
  expect(emptyStyle).toMatchObject({ flexGrow: 0, flexShrink: 0 });
  expect(StyleSheet.flatten(strip()!.props.contentContainerStyle)).toMatchObject({ alignItems: 'center' });
  mockRecipes = [{ id: 1, name: 'Toast', category: 'breakfast', prepMinutes: 2, cookMinutes: 3 }];
  await view.rerender(<PaperProvider theme={lightTheme}><RecipesScreen /></PaperProvider>);
  expect(StyleSheet.flatten(strip()!.props.style)).toEqual(emptyStyle);
});

it('wraps a long recipe name without shrinking or pushing out its duration', async () => {
  const name = 'A very long recipe name with roasted vegetables, chickpeas, lemon dressing and fresh herbs';
  mockRecipes = [{ id: 2, name, category: 'dinner', prepMinutes: 10, cookMinutes: 35 }];
  const view = await render(<PaperProvider theme={lightTheme}><RecipesScreen /></PaperProvider>);
  const title = view.getByTestId('recipe-name-2');
  const duration = view.getByTestId('recipe-duration-2');
  expect(view.getByText(name)).toBeTruthy();
  expect(view.getByText('45 min')).toBeTruthy();
  expect(StyleSheet.flatten(title.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
  expect(title.props.numberOfLines).toBeUndefined();
  expect(StyleSheet.flatten(duration.props.style)).toMatchObject({ flexShrink: 0 });
});
