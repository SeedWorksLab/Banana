export function nativeSpeech(): {
  modelDirectory(): Promise<string>;
  sha256(uri: string): Promise<string>;
  decodeAudio(uri: string): Promise<string>;
  fileSize(uri: string): Promise<number | null>;
  deleteFile(uri: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
} {
  throw new Error('Downloaded Whisper models are supported on Android only.');
}

export function isNativeSpeechAvailable(): boolean {
  return false;
}
