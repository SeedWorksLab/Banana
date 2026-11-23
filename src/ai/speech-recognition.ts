import * as android from './android-speech-recognition';
import * as whisper from '../dictation/whisper';
import { getDictationSettings, DEFAULT_DICTATION_SETTINGS } from '../database/dictation-settings';
import type { LiveTranscriptionHandle, LiveTranscriptionOptions } from './android-speech-recognition';

export type { LiveTranscriptionHandle, LiveTranscriptionOptions, TranscriptionResult } from './android-speech-recognition';
export { selectSpeechLocale } from './android-speech-recognition';

let prepared = DEFAULT_DICTATION_SETTINGS;
let active: LiveTranscriptionHandle | null = null;

export function isSpeechRecognitionAvailable(): boolean {
  return whisper.isWhisperAvailable() || android.isSpeechRecognitionAvailable();
}

export function supportsRecordedTranscription(): boolean {
  return whisper.isWhisperAvailable() || android.supportsRecordedTranscription();
}

export async function requestSpeechRecognitionPermission(language: string | null = null): Promise<boolean> {
  prepared = await getDictationSettings();
  const spoken = prepared.language === 'interface' ? language : prepared.language;
  if (prepared.engine === 'whisper') return whisper.prepareWhisper(prepared.model);
  if (spoken === 'auto') throw new Error('Automatic language detection requires Whisper. Choose a spoken language in Dictation settings.');
  return android.requestSpeechRecognitionPermission(spoken);
}

export function startLiveTranscription(options: LiveTranscriptionOptions) {
  if (active) throw new Error('Another dictation is running. Stop it before starting a new one.');
  const language = prepared.language === 'interface' ? options.language : prepared.language;
  const handle = prepared.engine === 'whisper'
    ? whisper.startWhisperTranscription({ ...options, language }, prepared.model)
    : android.startLiveTranscription({ ...options, language });
  active = handle;
  const clear = () => { if (active === handle) active = null; };
  void handle.finished.then(clear, clear);
  return handle;
}
