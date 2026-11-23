import type { WhisperModelId } from '../models/dictation';
import type { LiveTranscriptionHandle, LiveTranscriptionOptions } from '../ai/android-speech-recognition';

export function isWhisperAvailable(): boolean { return false; }

export async function prepareWhisper(_model: WhisperModelId): Promise<boolean> {
  throw new Error('Whisper dictation requires the Android app.');
}

export function startWhisperTranscription(_options: LiveTranscriptionOptions, _model: WhisperModelId): LiveTranscriptionHandle {
  throw new Error('Whisper dictation requires the Android app.');
}
