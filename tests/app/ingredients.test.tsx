import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import IngredientsScreen from '../../src/app/ingredients';
import { lightTheme } from '../../src/theme';

const mockSave = jest.fn(async () => {});
const mockAdd = jest.fn();
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../src/data/DataProvider', () => ({
  useAppData: () => ({
    ingredients: [{
      id: 12, name: 'Buter', category: 'dairy', defaultUnit: 'g', defaultQuantity: 250,
      isPantryStaple: false, shelfLifeDays: 14, notes: 'Unsalted',
    }],
    saveIngredient: mockSave, addIngredient: mockAdd,
  }),
}));

it('corrects a known ingredient in place, preserving its identity and other details', async () => {
  await render(<PaperProvider theme={lightTheme}><IngredientsScreen /></PaperProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Edit Buter' }));
  await fireEvent.changeText(screen.getByLabelText('Ingredient name'), 'Butter');
  await fireEvent.press(screen.getByRole('button', { name: 'Save ingredient' }));
  expect(mockSave).toHaveBeenCalledWith(12, {
    name: 'Butter', category: 'dairy', defaultUnit: 'g', defaultQuantity: 250,
    isPantryStaple: false, shelfLifeDays: 14, notes: 'Unsalted',
  });
  expect(mockAdd).not.toHaveBeenCalled();
});
