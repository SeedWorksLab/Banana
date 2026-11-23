import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import DictationSettingsScreen from '../../src/app/dictation-settings';
import { lightTheme } from '../../src/theme';
import type { DictationSettings } from '../../src/models/dictation';

const mockInstalled = new Set<string>();
const mockDownload = jest.fn(async (id: string, progress: (value: number) => void) => {
  progress(1);
  mockInstalled.add(id);
});
const mockDelete = jest.fn(async (id: string) => { mockInstalled.delete(id); });
const mockCancel = jest.fn(async () => {});
const mockSettings: DictationSettings = { engine: 'android', model: 'base', language: 'interface' };
const mockSave = jest.fn(async (patch: Partial<DictationSettings>) => Object.assign(mockSettings, patch));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
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
jest.mock('../../src/database/dictation-settings', () => ({
  DEFAULT_DICTATION_SETTINGS: { engine: 'android', model: 'base', language: 'interface' },
  getDictationSettings: async () => ({ ...mockSettings }),
  updateDictationSettings: (patch: Partial<DictationSettings>) => mockSave(patch),
}));
jest.mock('../../src/dictation/model-storage', () => ({
  supportsModelDownloads: () => true,
  isModelInstalled: async (id: string) => mockInstalled.has(id),
  downloadModel: (id: string, progress: (value: number) => void) => mockDownload(id, progress),
  deleteModel: (id: string) => mockDelete(id),
  cancelModelDownload: () => mockCancel(),
}));
jest.mock('../../src/dictation/whisper', () => ({ isWhisperAvailable: () => true }));

beforeEach(() => {
  jest.clearAllMocks();
  mockInstalled.clear();
  Object.assign(mockSettings, { engine: 'android', model: 'base', language: 'interface' });
});

async function openScreen() {
  await render(<PaperProvider theme={{ ...lightTheme, animation: { scale: 0 } }}><DictationSettingsScreen /></PaperProvider>);
  await waitFor(() => expect(screen.getByLabelText('Recognition engine: Android (offline)')).toBeTruthy());
}

it('requires explicit confirmation before downloading and exposes deletion after installation', async () => {
  await openScreen();
  expect(mockDownload).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('dictation-download-base'));
  expect(screen.getByText('Download speech model?')).toBeTruthy();
  expect(mockDownload).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Confirm model operation'));
  await waitFor(() => expect(screen.getByTestId('dictation-delete-base')).toBeTruthy());
  expect(mockDownload).toHaveBeenCalledWith('base', expect.any(Function));
  await fireEvent.press(screen.getByTestId('dictation-delete-base'));
  await fireEvent.press(screen.getByLabelText('Confirm model operation'));
  await waitFor(() => expect(screen.getByTestId('dictation-download-base')).toBeTruthy());
  expect(mockDelete).toHaveBeenCalledWith('base');
});

it('cancels confirmation without contacting the download host', async () => {
  await openScreen();
  await fireEvent.press(screen.getByTestId('dictation-download-small'));
  await fireEvent.press(screen.getByLabelText('Cancel model operation'));
  expect(mockDownload).not.toHaveBeenCalled();
});

it('saves the speech language independently of the application language', async () => {
  await openScreen();
  await fireEvent.press(screen.getByLabelText('Spoken language: Same as app language'));
  await fireEvent.press(screen.getByText('Deutsch'));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ language: 'de' }));
});
