import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import PantryScreen from '../../src/app/pantry';
import { lightTheme } from '../../src/theme';

const mockSave = jest.fn(async () => {});
const mockIngredients = [
  { id: 1, name: 'Apples', category: 'produce', defaultUnit: 'piece', shelfLifeDays: 7 },
  { id: 2, name: 'Butter', category: 'dairy', defaultUnit: 'g', shelfLifeDays: 14 },
];
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../src/data/DataProvider', () => ({
  useAppData: () => ({
    ingredients: mockIngredients,
    pantryItems: [],
    homes: [{ id: 1, name: 'Home' }],
    defaultHome: { id: 1 },
    savePantryItem: mockSave,
  }),
}));
jest.mock('../../src/components/option-field', () => {
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    OptionField: ({ label, value, options, onChange }: {
      label: string; value: string | number | null;
      options: { value: string | number; label: string }[];
      onChange: (value: string | number) => void;
    }) => (
      <View>
        <Text>{`${label}: ${value ?? 'unselected'}`}</Text>
        {options.map((option) => <Pressable key={option.value} accessibilityRole="button"
          accessibilityLabel={`${label}: ${option.label}`} onPress={() => onChange(option.value)}>
          <Text>{option.label}</Text>
        </Pressable>)}
      </View>
    ),
  };
});

it('requires an explicit ingredient and saves its approximate quantity in the selected home', async () => {
  await render(<PaperProvider theme={lightTheme}><PantryScreen /></PaperProvider>);
  await fireEvent.press(screen.getByTestId('pantry-add'));
  expect(screen.getByText('Ingredient: unselected')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save pantry item' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Ingredient: Butter' }));
  await fireEvent.changeText(screen.getByLabelText('Approximate quantity (optional)'), '500');
  await fireEvent.press(screen.getByRole('button', { name: 'Save pantry item' }));
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
    ingredientId: 2, homeId: 1, quantity: 500, unit: 'g', level: 'stocked',
  }));
});
