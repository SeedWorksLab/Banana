import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import DealsScreen from '../../src/app/(tabs)/deals';
import { lightTheme } from '../../src/theme';

const mockImport = jest.fn(async (_text: string) => ({ message: 'Offers saved' }));
const mockStop = jest.fn(async () => 'Butter 500 g costs two euros.');
const mockRecording = {
  recording: true, busy: false, hasRecording: false, error: null,
  start: jest.fn(), stopAndTranscribe: mockStop, discard: jest.fn(),
};
const mockDeals = Array.from({ length: 1000 }, (_, index) => ({
  id: index + 1, productName: `Offer ${String(index).padStart(4, '0')}`,
  storeId: 1, priceCents: 200, currency: 'EUR', referencePriceCents: null,
  validFrom: null, validTo: null,
}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../src/ai/use-leaflet-recording', () => ({
  useLeafletRecording: () => mockRecording,
}));
jest.mock('../../src/data/DataProvider', () => ({
  useAppData: () => ({
    settings: { language: 'en' },
    stores: [{ id: 1, storeId: 'lidl', name: 'Lidl', lastScrapedAt: null }],
    deals: mockDeals, dealMatches: [], ingredients: [],
    setDealMatchStatus: jest.fn(), importNewspaperText: mockImport,
    refreshDeals: jest.fn(), refreshingDeals: false, lastDealRefresh: null,
  }),
}));

it('renders only the initial offer window and sends stopped leaflet transcription to AI', async () => {
  await render(<PaperProvider theme={lightTheme}><DealsScreen /></PaperProvider>);
  expect(screen.getByText('Offer 0000')).toBeTruthy();
  expect(screen.queryByText('Offer 0999')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Read a leaflet out loud' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Stop recording and process leaflet' }));
  expect(mockStop).toHaveBeenCalledTimes(1);
  expect(mockImport).toHaveBeenCalledWith('Butter 500 g costs two euros.');
});
