type Listener = (event: unknown) => void;
const mockListeners = new Map<string, Set<Listener>>();
const mockModule = {
  isRecognitionAvailable: jest.fn(() => true),
  supportsOnDeviceRecognition: jest.fn(() => true),
  supportsRecording: jest.fn(() => true),
  getSupportedLocales: jest.fn(async () => ({ locales: ['en-US'], installedLocales: ['en-US'] })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  addListener: jest.fn((name: string, listener: Listener) => {
    const listeners = mockListeners.get(name) ?? new Set();
    listeners.add(listener);
    mockListeners.set(name, listeners);
    return { remove: () => listeners.delete(listener) };
  }),
};
jest.mock('expo-modules-core', () => {
  const actual = jest.requireActual<typeof import('expo-modules-core')>('expo-modules-core');
  return {
    ...actual,
    requireOptionalNativeModule: (name: string) => name === 'ExpoSpeechRecognition'
      ? mockModule : actual.requireOptionalNativeModule(name),
  };
});

import { startLiveTranscription, selectSpeechLocale, requestSpeechRecognitionPermission } from '../../src/ai/speech-recognition';

function emit(name: string, event: unknown = null) {
  [...(mockListeners.get(name) ?? [])].forEach((listener) => listener(event));
}

function result(transcript: string, isFinal = true) {
  emit('result', { isFinal, results: [{ transcript, confidence: 0.9 }] });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockListeners.clear();
});
afterEach(() => jest.useRealTimers());

it('keeps listening past eight seconds and retains every final segment', async () => {
  const onError = jest.fn();
  const onTranscript = jest.fn();
  const handle = startLiveTranscription({ language: 'de', contextualStrings: [], onError, onTranscript });
  result('Butter 500 Gramm.');
  jest.advanceTimersByTime(30000);
  result('Milch');
  result('ein Liter', false);
  const stopped = handle.stop();
  result('ein Liter.');
  emit('end');
  await expect(stopped).resolves.toEqual({ text: 'Butter 500 Gramm. Milch ein Liter.', confidence: 0.9 });
  expect(onTranscript).toHaveBeenLastCalledWith('Butter 500 Gramm. Milch ein Liter.');
  expect(mockModule.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'de-DE', requiresOnDeviceRecognition: true }));
  expect(onError).not.toHaveBeenCalled();
  expect([...mockListeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
});

it('waits for the last result after Stop rather than finishing on the first sentence', async () => {
  const handle = startLiveTranscription({ language: 'en', contextualStrings: [], onError: jest.fn() });
  result('First sentence.');
  let done = false;
  const stopped = handle.stop().then((value) => { done = true; return value; });
  await Promise.resolve();
  expect(done).toBe(false);
  result('Second sentence.');
  emit('end');
  expect((await stopped)?.text).toBe('First sentence. Second sentence.');
});

it('keeps partial speech when the recognizer does not send an end event', async () => {
  const handle = startLiveTranscription({ language: null, contextualStrings: [], onError: jest.fn() });
  result('Keep this text', false);
  const stopped = handle.stop();
  jest.advanceTimersByTime(8000);
  expect((await stopped)?.text).toBe('Keep this text');
  expect(mockModule.abort).toHaveBeenCalledTimes(1);
});

it('aborts immediately and releases its listeners for the next recording', async () => {
  const onError = jest.fn();
  const first = startLiveTranscription({ language: 'en', contextualStrings: [], onError });
  result('Cancelled text');
  first.abort();
  await expect(first.finished).resolves.toBeNull();
  const next = startLiveTranscription({ language: 'en', contextualStrings: [], onError });
  next.abort();
  expect(onError).not.toHaveBeenCalled();
});

it('surfaces silence instead of silently dropping an empty recording', async () => {
  const onError = jest.fn();
  const handle = startLiveTranscription({ language: 'en', contextualStrings: [], onError });
  emit('end');
  await expect(handle.finished).resolves.toBeNull();
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('No speech'));
});

it('transcribes a saved file locally through all of its segments', async () => {
  const handle = startLiveTranscription({
    language: 'en', contextualStrings: ['Butter'], audioUri: 'file:///leaflet.m4a', onError: jest.fn(),
  });
  result('Butter costs two euros.');
  result('Milk costs one euro.');
  emit('end');
  expect((await handle.finished)?.text).toBe('Butter costs two euros. Milk costs one euro.');
  expect(mockModule.start).toHaveBeenCalledWith(expect.objectContaining({
    requiresOnDeviceRecognition: true,
    audioSource: { uri: 'file:///leaflet.m4a', audioChannels: 1, sampleRate: 16000, audioEncoding: 2 },
  }));
});

it('cleans up synchronous startup failures', () => {
  mockModule.start.mockImplementationOnce(() => { throw new Error('Microphone busy'); });
  expect(() => startLiveTranscription({ language: 'en', contextualStrings: [], onError: jest.fn() })).toThrow('Microphone busy');
  const next = startLiveTranscription({ language: 'en', contextualStrings: [], onError: jest.fn() });
  next.abort();
});

it('selects installed regional variants instead of requiring the hardcoded locale', () => {
  expect(selectSpeechLocale('en', ['en-GB', 'de-DE'])).toBe('en-GB');
  expect(selectSpeechLocale('de', ['de_AT'])).toBe('de-AT');
  expect(selectSpeechLocale('hu', ['en-GB'])).toBe('en-GB');
  expect(selectSpeechLocale(null, [])).toBe('en-US');
});

it('queries the on-device recognizer and uses its installed language without enabling cloud speech', async () => {
  mockModule.getSupportedLocales.mockResolvedValueOnce({ locales: ['en-GB'], installedLocales: ['en-GB'] });
  expect(await requestSpeechRecognitionPermission('en')).toBe(true);
  const handle = startLiveTranscription({ language: 'en', contextualStrings: [], onError: jest.fn() });
  expect(mockModule.start).toHaveBeenLastCalledWith(expect.objectContaining({
    lang: 'en-GB', requiresOnDeviceRecognition: true,
  }));
  handle.abort();
});
