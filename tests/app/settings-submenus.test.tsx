import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import SettingsScreen from '../../src/app/(tabs)/settings';
import ShopsScreen from '../../src/app/shops';
import PreferencesDefaultsScreen from '../../src/app/preferences-defaults';
import { lightTheme } from '../../src/theme';
import { DEFAULT_SETTINGS as mockSettings } from '../../src/database/settings';
import { DEFAULT_PREFERENCES as mockPreferences } from '../../src/database/preferences';

const mockPush = jest.fn();
const mockSaveSettings = jest.fn(async () => {});
const mockSavePreferences = jest.fn(async () => {});
const mockSetStoreEnabled = jest.fn(async () => {});
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(), useRouter: () => ({ push: mockPush }),
}));
jest.mock('../../src/services/notifications', () => ({
  requestNotificationPermission: jest.fn(async () => true),
}));
jest.mock('../../src/data/DataProvider', () => ({
  useAppData: () => ({
    settings: mockSettings, preferences: mockPreferences,
    saveSettings: mockSaveSettings, savePreferences: mockSavePreferences,
    setStoreEnabled: mockSetStoreEnabled,
    stores: [
      { id: 1, storeId: 'lidl', country: 'AT', name: 'Lidl', enabled: true },
      { id: 2, storeId: 'dm_at', country: 'AT', name: 'dm', enabled: false },
    ],
  }),
}));

beforeEach(() => jest.clearAllMocks());
const theme = { ...lightTheme, animation: { scale: 0 } };

it('replaces the inline shops, preferences and planning controls with two independent links', async () => {
  await render(<PaperProvider theme={theme}><SettingsScreen /></PaperProvider>);
  expect(screen.queryByLabelText('Default servings')).toBeNull();
  expect(screen.queryByLabelText('Allergies')).toBeNull();
  expect(screen.queryByText('Lidl')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Shops' }));
  expect(mockPush).toHaveBeenCalledWith('/shops');
  await fireEvent.press(screen.getByRole('button', { name: 'Preferences & defaults' }));
  expect(mockPush).toHaveBeenCalledWith('/preferences-defaults');
});

it('keeps supported shop switches working on their dedicated page', async () => {
  await render(<PaperProvider theme={theme}><ShopsScreen /></PaperProvider>);
  expect(screen.getByText('Lidl')).toBeTruthy();
  expect(screen.queryByText('dm')).toBeNull();
  await fireEvent(screen.getByRole('switch', { name: 'Shops Lidl' }), 'valueChange', false);
  expect(mockSetStoreEnabled).toHaveBeenCalledWith(1, false);
});

it('keeps planning defaults, allergies, dislikes and budget editable on the combined page', async () => {
  await render(<PaperProvider theme={theme}><PreferencesDefaultsScreen /></PaperProvider>);
  expect(screen.getByText('Planning defaults')).toBeTruthy();
  expect(screen.getByText('Preferences')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Default servings'), '4');
  expect(mockSaveSettings).toHaveBeenCalledWith({ defaultServings: 4 });
  await fireEvent.changeText(screen.getByLabelText('Allergies'), 'Peanut, milk');
  await fireEvent(screen.getByLabelText('Allergies'), 'blur');
  expect(mockSavePreferences).toHaveBeenCalledWith({ allergies: ['Peanut', 'milk'] });
  await fireEvent.changeText(screen.getByLabelText('Dislikes'), 'Mushrooms');
  await fireEvent(screen.getByLabelText('Dislikes'), 'blur');
  expect(mockSavePreferences).toHaveBeenCalledWith({ dislikes: ['Mushrooms'] });
  await fireEvent.changeText(screen.getByLabelText('Weekly budget'), '90');
  expect(mockSavePreferences).toHaveBeenCalledWith({ weeklyBudgetCents: 9000 });
});
