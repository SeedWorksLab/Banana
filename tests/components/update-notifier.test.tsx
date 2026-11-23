import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { UpdateNotifier } from '../../src/components/update-notifier';
import { getUpdatePreferences, saveUpdatePreferences } from '../../src/database/update-preferences';
import { checkForUpdate } from '../../src/updates/check-for-update';
import { installUpdate } from '../../src/updates/install-update';
import { lightTheme } from '../../src/theme';

jest.mock('../../src/data/DataProvider', () => ({ useAppData: () => ({ ready: true }) }));
jest.mock('../../src/database/update-preferences', () => ({
  getUpdatePreferences: jest.fn(), saveUpdatePreferences: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/updates/check-for-update', () => ({ checkForUpdate: jest.fn() }));
jest.mock('../../src/updates/install-update', () => ({ installUpdate: jest.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getUpdatePreferences).mockResolvedValue({ enabled: true, ignoredVersion: null });
  jest.mocked(checkForUpdate).mockResolvedValue({
    version: '0.3.0', url: 'https://github.com/SeedWorksLab/Banana/releases/tag/v0.3.0',
    apkUrl: 'https://github.com/SeedWorksLab/Banana/releases/download/v0.3.0/banana.apk',
  });
});

it('does not check releases when startup checks are disabled', async () => {
  jest.mocked(getUpdatePreferences).mockResolvedValue({ enabled: false, ignoredVersion: null });
  await render(<PaperProvider theme={lightTheme}><UpdateNotifier /></PaperProvider>);
  await waitFor(() => expect(getUpdatePreferences).toHaveBeenCalled());
  expect(checkForUpdate).not.toHaveBeenCalled();
});

it('persists the ignored version', async () => {
  await render(<PaperProvider theme={lightTheme}><UpdateNotifier /></PaperProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Ignore this update version' }));
  await waitFor(() => expect(saveUpdatePreferences).toHaveBeenCalledWith({ ignoredVersion: '0.3.0' }));
});

it('downloads only after the user chooses Update now', async () => {
  await render(<PaperProvider theme={lightTheme}><UpdateNotifier /></PaperProvider>);
  const button = await screen.findByRole('button', { name: 'Update now' });
  expect(installUpdate).not.toHaveBeenCalled();
  await fireEvent.press(button);
  await waitFor(() => expect(installUpdate).toHaveBeenCalledTimes(1));
});

it('dismissing does not ignore a version permanently', async () => {
  await render(<PaperProvider theme={lightTheme}><UpdateNotifier /></PaperProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Close update prompt' }));
  expect(saveUpdatePreferences).not.toHaveBeenCalled();
  expect(installUpdate).not.toHaveBeenCalled();
});
