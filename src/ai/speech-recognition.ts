import { requireOptionalNativeModule } from 'expo-modules-core';

export interface LiveTranscriptionHandle {
  stop(): Promise<{ text: string; confidence: number | null } | null>;
  abort(): void;
}

export interface LiveTranscriptionOptions {
  language: string | null;
  contextualStrings: string[];
  onError: (message: string) => void;
}

type SpeechRecognitionModule = typeof import('expo-speech-recognition')['ExpoSpeechRecognitionModule'];

const STOP_TIMEOUT_MS = 8000;

let cachedModule: SpeechRecognitionModule | null | undefined;

function speechModule(): SpeechRecognitionModule | null {
  if (cachedModule === undefined) {
    cachedModule = requireOptionalNativeModule<SpeechRecognitionModule>('ExpoSpeechRecognition');
  }
  return cachedModule;
}

export function isSpeechRecognitionAvailable(): boolean {
  const module = speechModule();
  return module !== null && module.isRecognitionAvailable();
}

export async function requestSpeechRecognitionPermission(): Promise<boolean> {
  const module = speechModule();
  if (module === null) {
    return false;
  }
  const response = await module.requestPermissionsAsync();
  return response.granted;
}

export function startLiveTranscription(options: LiveTranscriptionOptions): LiveTranscriptionHandle {
  const module = speechModule();
  if (module === null) {
    return { stop: async () => null, abort: () => {} };
  }

  let transcript = '';
  let confidence: number | null = null;
  let stopped = false;

  const finish = new Promise<void>((resolve) => {
    const stopTimer = setTimeout(resolve, STOP_TIMEOUT_MS);

    const onEnd = () => {
      clearTimeout(stopTimer);
      resolve();
    };
    const onError = (event: { message?: string; code?: string }) => {
      options.onError(event.message ?? event.code ?? 'Speech recognition failed');
      clearTimeout(stopTimer);
      resolve();
    };
    const onResult = (event: {
      isFinal: boolean;
      results: { transcript: string; confidence: number }[];
    }) => {
      if (event.results.length > 0) {
        transcript = event.results[0].transcript;
        const raw = event.results[0].confidence;
        confidence = raw >= 0 ? raw : null;
      }
      if (event.isFinal) {
        clearTimeout(stopTimer);
        resolve();
      }
    };

    const resultSub = module.addListener('result', onResult as never);
    const endSub = module.addListener('end', onEnd as never);
    const errorSub = module.addListener('error', onError as never);

    module.start({
      lang: options.language ?? 'en',
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      contextualStrings: options.contextualStrings,
    });

    finish.then(() => {
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
      stopped = true;
    });
  });

  return {
    stop: async () => {
      if (!stopped) {
        module.stop();
        await finish;
      }
      return transcript === '' ? null : { text: transcript, confidence };
    },
    abort: () => {
      if (!stopped) {
        module.abort();
      }
    },
  };
}
