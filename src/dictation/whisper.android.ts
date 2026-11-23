import { TurboModuleRegistry } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import type { AudioRecorder, NativeAudioModule } from 'expo-audio';
import { File } from 'expo-file-system';
import { initWhisper, type WhisperContext } from 'whisper.rn/index';
import type { LiveTranscriptionHandle, LiveTranscriptionOptions, TranscriptionResult } from '../ai/android-speech-recognition';
import type { WhisperModelId } from '../models/dictation';
import { acquireModel, verifiedModelPath, isModelInstalled } from './model-storage';
import { isNativeSpeechAvailable, nativeSpeech } from './native-speech';

export function isWhisperAvailable(): boolean {
  return isNativeSpeechAvailable() && TurboModuleRegistry.get('RNWhisper') !== null;
}

export async function prepareWhisper(model: WhisperModelId): Promise<boolean> {
  if (!isWhisperAvailable()) throw new Error('Whisper requires a new Android build of Banana; Expo Go is not supported.');
  if (!(await isModelInstalled(model))) throw new Error('Download the selected Whisper model in Settings → Dictation first.');
  return (await AudioModule.requestRecordingPermissionsAsync()).granted;
}

function removeAudio(uri: string | null) {
  if (!uri) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}

export function startWhisperTranscription(options: LiveTranscriptionOptions, model: WhisperModelId): LiveTranscriptionHandle {
  const audioModule: NativeAudioModule = AudioModule;
  const Recorder = audioModule.AudioRecorder;
  const releaseModel = acquireModel(model);
  let aborted = false;
  let stopRequested = Boolean(options.audioUri);
  let resolveStop!: () => void;
  const stopped = new Promise<void>((resolve) => { resolveStop = resolve; });
  let stopInference: (() => Promise<void>) | null = null;
  let recorder: AudioRecorder | null = null;
  let context: WhisperContext | null = null;
  let decodedUri: string | null = null;
  let recordedUri: string | null = null;
  let subscription: { remove(): void } | null = null;
  let recordingError: string | null = null;
  let recordingMode = false;

  const finished = (async (): Promise<TranscriptionResult | null> => {
    try {
      if (aborted) return null;
      let audioUri = options.audioUri;
      if (!audioUri) {
        await setAudioModeAsync({ allowsRecording: true, allowsBackgroundRecording: false });
        recordingMode = true;
        if (aborted) return null;
        recorder = new Recorder({
          ...RecordingPresets.HIGH_QUALITY,
          ...RecordingPresets.HIGH_QUALITY.android,
          sampleRate: 16000, numberOfChannels: 1, bitRate: 64000,
        });
        subscription = recorder.addListener('recordingStatusUpdate', (status) => {
          if (status.hasError || status.isFinished) {
            recordingError = status.hasError ? status.error ?? 'Recording was interrupted.' : null;
            resolveStop();
          }
        });
        await recorder.prepareToRecordAsync();
        if (aborted) return null;
        if (!stopRequested) {
          recorder.record();
          await stopped;
        }
        recordedUri = recorder.uri;
        if (recorder.isRecording) await recorder.stop();
        if (recordingError) throw new Error(recordingError);
        if (aborted) return null;
        audioUri = recorder.uri ?? recordedUri ?? undefined;
        await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false });
        recordingMode = false;
      }
      if (aborted) return null;
      if (!audioUri) throw new Error('No recorded audio was found. Try dictation again.');
      options.onProcessing?.(true);
      const path = await verifiedModelPath(model);
      if (aborted) return null;
      decodedUri = await nativeSpeech().decodeAudio(audioUri);
      if (aborted) return null;
      context = await initWhisper({ filePath: path, useGpu: false });
      if (aborted) return null;
      const task = context.transcribe(decodedUri, {
        language: options.language === 'auto' ? 'auto' : (options.language ?? 'en').split('-')[0],
        translate: false,
        maxThreads: 4,
        onNewSegments: (result) => { if (!aborted) options.onTranscript?.(result.result.trim()); },
      });
      stopInference = task.stop;
      const result = await task.promise;
      if (aborted || result.isAborted) return null;
      const text = result.result.trim();
      if (!text) throw new Error('No speech was recognised. Try speaking closer to the microphone.');
      options.onTranscript?.(text);
      return { text, confidence: null };
    } catch (error) {
      if (!aborted) options.onError(error instanceof Error ? error.message : 'Local transcription failed.');
      return null;
    } finally {
      let cleanupFailed = false;
      async function releaseResource(action: () => void | Promise<void>) {
        try { await action(); }
        catch {
          cleanupFailed = true;
        }
      }
      await releaseResource(() => subscription?.remove());
      await releaseResource(async () => { if (recorder?.isRecording) await recorder.stop(); });
      await releaseResource(() => { recordedUri = recorder?.uri ?? recordedUri; });
      await releaseResource(() => recorder?.release());
      await releaseResource(async () => { await context?.release(); });
      await releaseResource(async () => {
        if (recordingMode) await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false });
      });
      await releaseResource(() => removeAudio(decodedUri));
      await releaseResource(() => removeAudio(recordedUri));
      releaseModel();
      options.onProcessing?.(false);
      if (cleanupFailed && !aborted) options.onError('Dictation finished, but some audio resources could not be released. Restart Banana before recording again.');
    }
  })();

  return {
    finished,
    stop: () => {
      stopRequested = true;
      resolveStop();
      return finished;
    },
    abort: () => {
      aborted = true;
      resolveStop();
      void stopInference?.().catch(() => {});
    },
  };
}
