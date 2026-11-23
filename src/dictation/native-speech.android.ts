import { requireOptionalNativeModule } from 'expo-modules-core';

interface NativeSpeech {
  modelDirectory(): Promise<string>;
  sha256(uri: string): Promise<string>;
  decodeAudio(uri: string): Promise<string>;
  fileSize(uri: string): Promise<number | null>;
  deleteFile(uri: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
}

export function nativeSpeech(): NativeSpeech {
  const module = requireOptionalNativeModule<NativeSpeech>('BananaSpeech');
  if (!module) throw new Error('Local dictation needs a new Android build of Banana. It is not available in Expo Go.');
  return module;
}

export function isNativeSpeechAvailable(): boolean {
  return requireOptionalNativeModule<NativeSpeech>('BananaSpeech') !== null;
}
