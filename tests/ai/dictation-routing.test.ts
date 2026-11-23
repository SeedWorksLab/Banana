import { requestSpeechRecognitionPermission, startLiveTranscription } from '../../src/ai/speech-recognition';
import type { DictationSettings } from '../../src/models/dictation';

const mockSettings: DictationSettings = { engine: 'android', model: 'base', language: 'interface' };
const mockAndroidPermission = jest.fn(async (_language: string) => true);
const mockWhisperPermission = jest.fn(async (_model: string) => true);
const mockAndroidStart = jest.fn();
const mockWhisperStart = jest.fn();
jest.mock('../../src/database/dictation-settings', () => ({
  DEFAULT_DICTATION_SETTINGS: { engine: 'android', model: 'base', language: 'interface' },
  getDictationSettings: async () => ({ ...mockSettings }),
}));
jest.mock('../../src/ai/android-speech-recognition', () => ({
  requestSpeechRecognitionPermission: (language: string) => mockAndroidPermission(language),
  startLiveTranscription: (options: unknown) => mockAndroidStart(options),
}));
jest.mock('../../src/dictation/whisper', () => ({
  prepareWhisper: (model: string) => mockWhisperPermission(model),
  startWhisperTranscription: (options: unknown, model: string) => mockWhisperStart(options, model),
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockSettings, { engine: 'android', model: 'base', language: 'interface' });
  mockAndroidStart.mockReturnValue({ finished: Promise.resolve(null) });
  mockWhisperStart.mockReturnValue({ finished: Promise.resolve(null) });
});

it('retains Android by default and honours an independently selected speech language', async () => {
  mockSettings.language = 'hu';
  await requestSpeechRecognitionPermission('de');
  startLiveTranscription({ language: 'de', contextualStrings: [], onError: jest.fn() });
  expect(mockAndroidPermission).toHaveBeenCalledWith('hu');
  expect(mockAndroidStart).toHaveBeenCalledWith(expect.objectContaining({ language: 'hu' }));
  expect(mockWhisperStart).not.toHaveBeenCalled();
});

it('routes microphone and saved audio to the selected local Whisper model', async () => {
  Object.assign(mockSettings, { engine: 'whisper', model: 'small', language: 'auto' });
  await requestSpeechRecognitionPermission('de');
  startLiveTranscription({ language: 'de', contextualStrings: [], audioUri: 'file:///leaflet.m4a', onError: jest.fn() });
  expect(mockWhisperPermission).toHaveBeenCalledWith('small');
  expect(mockWhisperStart).toHaveBeenCalledWith(expect.objectContaining({ language: 'auto', audioUri: 'file:///leaflet.m4a' }), 'small');
  expect(mockAndroidStart).not.toHaveBeenCalled();
});

it('does not silently use Android if the selected Whisper model is missing', async () => {
  mockSettings.engine = 'whisper';
  mockWhisperPermission.mockRejectedValueOnce(new Error('Download the model first'));
  await expect(requestSpeechRecognitionPermission('en')).rejects.toThrow('Download');
  expect(mockAndroidPermission).not.toHaveBeenCalled();
});

it('does not pass unsupported automatic language selection to Android', async () => {
  mockSettings.language = 'auto';
  await expect(requestSpeechRecognitionPermission('en')).rejects.toThrow('requires Whisper');
  expect(mockAndroidPermission).not.toHaveBeenCalled();
});
