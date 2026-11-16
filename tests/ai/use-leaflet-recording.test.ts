import { act, renderHook } from '@testing-library/react-native';
import { useLeafletRecording } from '../../src/ai/use-leaflet-recording.android';

const mockDelete = jest.fn();
const mockMode = jest.fn(async (_mode: unknown) => {});
const mockPermission = jest.fn(async () => ({ granted: true }));
const mockNotifications = jest.fn(async () => ({ granted: true }));
const mockRecorder = {
  isRecording: false,
  currentTime: 60,
  uri: 'file:///leaflet.m4a',
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(() => { mockRecorder.isRecording = true; }),
  stop: jest.fn(async () => { mockRecorder.isRecording = false; }),
};
const mockTranscribe = jest.fn();
jest.mock('expo-audio', () => ({
  AudioModule: { requestRecordingPermissionsAsync: () => mockPermission() },
  RecordingPresets: { HIGH_QUALITY: { android: { outputFormat: 'mpeg4', audioEncoder: 'aac' } } },
  setAudioModeAsync: (mode: unknown) => mockMode(mode),
  useAudioRecorder: () => mockRecorder,
  useAudioRecorderState: () => ({ isRecording: mockRecorder.isRecording }),
}));
jest.mock('expo-notifications', () => ({ requestPermissionsAsync: () => mockNotifications() }));
jest.mock('expo-file-system', () => ({
  File: class { exists = true; delete = mockDelete; },
}));
jest.mock('../../src/ai/speech-recognition', () => ({
  requestSpeechRecognitionPermission: async () => true,
  supportsRecordedTranscription: () => true,
  startLiveTranscription: (options: unknown) => mockTranscribe(options),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorder.isRecording = false;
  mockPermission.mockResolvedValue({ granted: true });
  mockTranscribe.mockReturnValue({
    finished: Promise.resolve({ text: 'Butter 500 g costs two euros.', confidence: null }),
    abort: jest.fn(),
  });
});

it('enables the Android background recorder and transcribes its file after Stop', async () => {
  const { result, rerender } = await renderHook(() => useLeafletRecording('en', ['Butter']));
  await act(async () => { await result.current.start(); });
  await rerender({});
  expect(mockMode).toHaveBeenCalledWith({ allowsRecording: true, allowsBackgroundRecording: true });
  expect(mockRecorder.record).toHaveBeenCalledTimes(1);
  expect(result.current.recording).toBe(true);
  let text: string | null = null;
  await act(async () => { text = await result.current.stopAndTranscribe(); });
  expect(text).toBe('Butter 500 g costs two euros.');
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  expect(mockTranscribe).toHaveBeenCalledWith(expect.objectContaining({ audioUri: 'file:///leaflet.m4a', language: 'en' }));
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(result.current.hasRecording).toBe(false);
});

it('keeps failed audio for retry instead of uploading or discarding it', async () => {
  mockTranscribe.mockImplementationOnce((options: { onError: (message: string) => void }) => {
    options.onError('Offline language missing');
    return { finished: Promise.resolve(null), abort: jest.fn() };
  });
  const { result } = await renderHook(() => useLeafletRecording('de', []));
  await act(async () => { await result.current.start(); });
  await act(async () => { await result.current.stopAndTranscribe(); });
  expect(result.current.error).toBe('Offline language missing');
  expect(result.current.hasRecording).toBe(true);
  expect(mockDelete).not.toHaveBeenCalled();
  await act(async () => { await result.current.stopAndTranscribe(); });
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockRecorder.record).toHaveBeenCalledTimes(1);
});

it('does not start recording when microphone permission is denied', async () => {
  mockPermission.mockResolvedValue({ granted: false });
  const { result } = await renderHook(() => useLeafletRecording('en', []));
  await act(async () => { await result.current.start(); });
  expect(mockRecorder.record).not.toHaveBeenCalled();
  expect(result.current.error).toContain('microphone');
});

it('stops and deletes a cancelled recording', async () => {
  const { result } = await renderHook(() => useLeafletRecording('en', []));
  await act(async () => { await result.current.start(); });
  await act(async () => { await result.current.discard(); });
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockTranscribe).not.toHaveBeenCalled();
});
