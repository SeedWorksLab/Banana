import { useEffect, useRef, useState } from 'react';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { requestPermissionsAsync } from 'expo-notifications';
import { File } from 'expo-file-system';
import {
  requestSpeechRecognitionPermission,
  startLiveTranscription,
  supportsRecordedTranscription,
  type LiveTranscriptionHandle,
} from './speech-recognition';

export function useLeafletRecording(language: string, contextualStrings: string[]) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const transcription = useRef<LiveTranscriptionHandle | null>(null);
  const discardedUri = useRef<string | null>(null);
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  }, (status) => {
    if (status.hasError) setError(status.error ?? 'Recording was interrupted. Try transcribing the saved audio.');
    if (status.isFinished && status.url && status.url !== discardedUri.current) setUri(status.url);
  });
  const state = useAudioRecorderState(recorder);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      transcription.current?.abort();
    };
  }, []);

  async function start() {
    if (locked.current || recorder.isRecording || uri) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!supportsRecordedTranscription()) {
        throw new Error('Recorded transcription needs Android 13 or newer and an installed on-device speech recognizer.');
      }
      if (!(await AudioModule.requestRecordingPermissionsAsync()).granted ||
          !(await requestSpeechRecognitionPermission())) {
        throw new Error('Allow microphone access to record a leaflet.');
      }
      if (!(await requestPermissionsAsync()).granted) {
        throw new Error('Allow notifications so Android can show the background recording notification.');
      }
      if (!mounted.current) return;
      await setAudioModeAsync({ allowsRecording: true, allowsBackgroundRecording: true });
      if (!mounted.current) return;
      await recorder.prepareToRecordAsync();
      if (!mounted.current) return;
      recorder.record();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start recording');
      await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false });
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function stopAndTranscribe(): Promise<string | null> {
    if (locked.current) return null;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const duration = recorder.currentTime;
      if (recorder.isRecording) await recorder.stop();
      const recordingUri = uri ?? recorder.uri;
      if (!recordingUri) throw new Error('No recorded audio was found. Start recording first.');
      setUri(recordingUri);
      await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false });
      let failure: string | null = null;
      const handle = startLiveTranscription({
        language,
        contextualStrings,
        audioUri: recordingUri,
        timeoutMs: Math.max(60000, duration * 2000 + 30000),
        onError: (message) => { failure = message; },
      });
      transcription.current = handle;
      const result = await handle.finished;
      transcription.current = null;
      if (!mounted.current) return null;
      if (failure) throw new Error(failure);
      if (!result?.text) throw new Error('No speech was recognised. The audio is kept; you can retry transcription.');
      discardedUri.current = recordingUri;
      const file = new File(recordingUri);
      if (file.exists) file.delete();
      setUri(null);
      return result.text;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not transcribe the recording');
      return null;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function discard() {
    if (locked.current) return;
    transcription.current?.abort();
    if (recorder.isRecording) await recorder.stop();
    const recordingUri = uri ?? recorder.uri;
    if (recordingUri) {
      discardedUri.current = recordingUri;
      const file = new File(recordingUri);
      if (file.exists) file.delete();
    }
    setUri(null);
    setError(null);
    await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false });
  }

  return { recording: state.isRecording, busy, hasRecording: uri !== null, error, start, stopAndTranscribe, discard };
}
