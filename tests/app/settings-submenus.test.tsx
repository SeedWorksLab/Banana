import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
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
const mockSaveUpdatePreferences = jest.fn(async (_patch: { enabled: boolean }) => {});
jest.mock('../../src/database/update-preferences', () => ({
  getUpdatePreferences: async () => ({ enabled: true, ignoredVersion: null }),
  saveUpdatePreferences: (patch: { enabled: boolean }) => mockSaveUpdatePreferences(patch),
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
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(), useRouter: () => ({ push: mockPush }),
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

it('groups the settings into appearance, pantry, account/AI and help cards', async () => {
  await render(<PaperProvider theme={theme}><SettingsScreen /></PaperProvider>);
  const appearance = within(screen.getByTestId('settings-appearance-group'));
  expect(appearance.queryByText('Appearance')).toBeNull();
  expect(screen.queryByTestId('option-Theme')).toBeNull();
  expect(screen.queryByTestId('option-Language')).toBeNull();
  expect(appearance.getByRole('button', { name: 'Preferences & defaults' })).toBeTruthy();
  expect(appearance.getByRole('button', { name: 'Shops' })).toBeTruthy();
  expect(screen.queryByLabelText('Budget and list currency: Euro (€)')).toBeNull();
  expect(screen.queryByText('Currency')).toBeNull();

  const pantry = within(screen.getByTestId('settings-pantry-group'));
  expect(pantry.getByRole('button', { name: 'Pantry and homes' })).toBeTruthy();
  expect(pantry.getByRole('button', { name: 'Known ingredients' })).toBeTruthy();
  expect(pantry.queryByRole('button', { name: 'Shops' })).toBeNull();

  const account = within(screen.getByTestId('settings-account-ai-group'));
  expect(account.queryByText('Reminders')).toBeNull();
  expect(account.getByRole('switch', { name: 'Check for updates' })).toBeTruthy();
  expect(screen.queryByRole('switch', { name: 'Plan updates' })).toBeNull();
  for (const name of ['SeedWorks account', 'AI provider', 'Dictation']) {
    expect(account.getByRole('button', { name })).toBeTruthy();
  }
  expect(account.queryByText('Known ingredients')).toBeNull();

  const help = within(screen.getByTestId('settings-help-group'));
  for (const name of ['Backup and restore', 'Tutorial', "What's new", 'About']) {
    expect(help.getByRole('button', { name })).toBeTruthy();
  }
});

it('keeps currency editable in Preferences & defaults', async () => {
  await render(<PaperProvider theme={theme}><PreferencesDefaultsScreen /></PaperProvider>);
  expect(screen.getByText('Currency')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('option-Budget and list currency'));
  await fireEvent.press(screen.getByText('Forint (Ft)'));
  expect(mockSaveSettings).toHaveBeenCalledWith({ currency: 'HUF' });
});

it('keeps only the update-check toggle in a rounded, non-navigation row', async () => {
  await render(<PaperProvider theme={theme}><SettingsScreen /></PaperProvider>);
  const row = screen.getByTestId('settings-check-updates');
  expect(StyleSheet.flatten(row.props.style)).toEqual(expect.objectContaining({ borderRadius: lightTheme.radii.pill }));
  expect(row.props.onPress).toBeUndefined();
  expect(screen.queryByText('Plan updates')).toBeNull();
  const updates = screen.getByRole('switch', { name: 'Check for updates' });
  await waitFor(() => expect(updates.props.accessibilityState.disabled).toBe(false));
  await fireEvent(updates, 'valueChange', false);
  expect(mockSaveUpdatePreferences).toHaveBeenCalledWith({ enabled: false });
  expect(mockSaveSettings).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it('moves working theme and language controls into Preferences & defaults', async () => {
  await render(<PaperProvider theme={theme}><PreferencesDefaultsScreen /></PaperProvider>);
  expect(screen.getByText('Appearance')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('option-Theme'));
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Dark' }));
  expect(mockSaveSettings).toHaveBeenCalledWith({ themeMode: 'dark' });
  await fireEvent.press(screen.getByTestId('option-Language'));
  await fireEvent.press(screen.getByRole('menuitem', { name: 'Deutsch' }));
  expect(mockSaveSettings).toHaveBeenCalledWith({ language: 'de' });
});

it('preserves navigation for the regrouped account, model and help links', async () => {
  await render(<PaperProvider theme={theme}><SettingsScreen /></PaperProvider>);
  const routes = [
    ['SeedWorks account', '/seedworks'], ['AI provider', '/ai-provider'], ['Dictation', '/dictation-settings'],
    ['Pantry and homes', '/pantry'], ['Known ingredients', '/ingredients'],
    ['Backup and restore', '/backup'], ['Tutorial', '/tutorial?replay=1'], ["What's new", '/whats-new'], ['About', '/about'],
  ];
  for (const [name, route] of routes) {
    await fireEvent.press(screen.getByRole('button', { name }));
    expect(mockPush).toHaveBeenLastCalledWith(route);
  }
});
