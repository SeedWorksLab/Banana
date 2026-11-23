import { TurboModuleRegistry } from 'react-native';
import { prepareWhisper, startWhisperTranscription } from '../../src/dictation/whisper.android';

const mockDelete = jest.fn();
const mockModelPath = jest.fn(async () => 'file:///no_backup/base.bin');
const mockInstalled = jest.fn(async () => true);
const mockReleaseLock = jest.fn();
const mockReleaseContext = jest.fn(async () => {});
const mockStopInference = jest.fn(async () => {});
const mockDecode = jest.fn(async (_uri: string) => 'file:///cache/decoded.wav');
const mockPermission = jest.fn(async () => ({ granted: true }));
const mockMode = jest.fn(async (_options: unknown) => {});
const mockTranscribe = jest.fn();
const mockInit = jest.fn(async (_options: unknown) => ({
  transcribe: (...args: unknown[]) => mockTranscribe(...args), release: mockReleaseContext,
}));
const mockRecord = jest.fn();
const mockStopRecording = jest.fn(async () => {});
const mockReleaseRecorder = jest.fn();

jest.mock('../../src/dictation/model-storage', () => ({
  acquireModel: () => mockReleaseLock,
  verifiedModelPath: () => mockModelPath(),
  isModelInstalled: () => mockInstalled(),
}));
jest.mock('../../src/dictation/native-speech', () => ({
  isNativeSpeechAvailable: () => true,
  nativeSpeech: () => ({ decodeAudio: (uri: string) => mockDecode(uri) }),
}));
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    exists = true;
    delete() { mockDelete(this.uri); }
  },
}));
jest.mock('expo-audio', () => ({
  AudioModule: {
    requestRecordingPermissionsAsync: () => mockPermission(),
    AudioRecorder: class {
      uri = 'file:///cache/microphone.m4a';
      isRecording = false;
      addListener() { return { remove: jest.fn() }; }
      async prepareToRecordAsync() {}
      record() { this.isRecording = true; mockRecord(); }
      async stop() { this.isRecording = false; await mockStopRecording(); }
      release = mockReleaseRecorder;
    },
  },
  RecordingPresets: { HIGH_QUALITY: {} },
  setAudioModeAsync: (options: unknown) => mockMode(options),
}));
jest.mock('whisper.rn/index', () => ({ initWhisper: (options: unknown) => mockInit(options) }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({} as ReturnType<typeof TurboModuleRegistry.get>);
  mockInstalled.mockResolvedValue(true);
  mockTranscribe.mockReturnValue({
    stop: mockStopInference, promise: Promise.resolve({ result: 'Butter 500 Gramm.', isAborted: false }),
  });
});
afterEach(() => jest.restoreAllMocks());

async function flush() {
  for (let index = 0; index < 30; index++) await Promise.resolve();
}

it('requires an installed model and microphone permission without downloading anything', async () => {
  expect(await prepareWhisper('base')).toBe(true);
  mockInstalled.mockResolvedValue(false);
  await expect(prepareWhisper('base')).rejects.toThrow('Download');
});

it('transcribes saved AAC locally as PCM WAV with the selected language, without translation', async () => {
  const onTranscript = jest.fn();
  const onProcessing = jest.fn();
  const handle = startWhisperTranscription({
    language: 'de', audioUri: 'file:///leaflet.m4a', contextualStrings: [], onError: jest.fn(), onTranscript, onProcessing,
  }, 'base');
  expect(await handle.finished).toEqual({ text: 'Butter 500 Gramm.', confidence: null });
  expect(mockDecode).toHaveBeenCalledWith('file:///leaflet.m4a');
  expect(mockInit).toHaveBeenCalledWith({ filePath: 'file:///no_backup/base.bin', useGpu: false });
  expect(mockTranscribe).toHaveBeenCalledWith('file:///cache/decoded.wav', expect.objectContaining({
    language: 'de', translate: false, maxThreads: 4,
  }));
  expect(onTranscript).toHaveBeenCalledWith('Butter 500 Gramm.');
  expect(onProcessing.mock.calls).toEqual([[true], [false]]);
  expect(mockDelete).toHaveBeenCalledWith('file:///cache/decoded.wav');
  expect(mockDelete).not.toHaveBeenCalledWith('file:///leaflet.m4a');
  expect(mockReleaseContext).toHaveBeenCalledTimes(1);
  expect(mockReleaseLock).toHaveBeenCalledTimes(1);
});

it('starts recording before model verification and transcribes only after Stop', async () => {
  const handle = startWhisperTranscription({
    language: 'en', contextualStrings: [], onError: jest.fn(),
  }, 'base');
  await flush();
  expect(mockRecord).toHaveBeenCalledTimes(1);
  expect(mockModelPath).not.toHaveBeenCalled();
  expect(mockTranscribe).not.toHaveBeenCalled();
  await handle.stop();
  expect(mockStopRecording).toHaveBeenCalledTimes(1);
  expect(mockDecode).toHaveBeenCalledWith('file:///cache/microphone.m4a');
  expect(mockDelete).toHaveBeenCalledWith('file:///cache/microphone.m4a');
  expect(mockReleaseRecorder).toHaveBeenCalledTimes(1);
});

it('aborts active inference, suppresses late text, and releases native memory', async () => {
  let finish!: (result: { result: string; isAborted: boolean }) => void;
  mockTranscribe.mockReturnValue({
    stop: mockStopInference, promise: new Promise((resolve) => { finish = resolve; }),
  });
  const onTranscript = jest.fn();
  const handle = startWhisperTranscription({
    language: 'auto', audioUri: 'file:///leaflet.m4a', contextualStrings: [], onError: jest.fn(), onTranscript,
  }, 'small');
  await flush();
  handle.abort();
  finish({ result: 'Late text', isAborted: true });
  expect(await handle.finished).toBeNull();
  expect(mockStopInference).toHaveBeenCalledTimes(1);
  expect(onTranscript).not.toHaveBeenCalled();
  expect(mockReleaseContext).toHaveBeenCalledTimes(1);
  expect(mockReleaseLock).toHaveBeenCalledTimes(1);
});

it('keeps externally supplied audio on failure for the leaflet retry flow', async () => {
  mockTranscribe.mockImplementationOnce(() => ({
    stop: mockStopInference, promise: Promise.reject(new Error('Out of memory')),
  }));
  const onError = jest.fn();
  const handle = startWhisperTranscription({
    language: 'hu', audioUri: 'file:///leaflet.m4a', contextualStrings: [], onError,
  }, 'small');
  expect(await handle.finished).toBeNull();
  expect(onError).toHaveBeenCalledWith('Out of memory');
  expect(mockDelete).not.toHaveBeenCalledWith('file:///leaflet.m4a');
  expect(mockReleaseLock).toHaveBeenCalledTimes(1);
});

it('releases the model lock and temporary audio even if native context cleanup fails', async () => {
  mockReleaseContext.mockRejectedValueOnce(new Error('Context already released'));
  const onError = jest.fn();
  const handle = startWhisperTranscription({
    language: 'en', audioUri: 'file:///leaflet.m4a', contextualStrings: [], onError,
  }, 'base');
  expect((await handle.finished)?.text).toBe('Butter 500 Gramm.');
  expect(mockReleaseLock).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledWith('file:///cache/decoded.wav');
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('could not be released'));
});
