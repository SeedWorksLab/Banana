import { requireOptionalNativeModule } from 'expo-modules-core';

export interface TranscriptionResult {
  text: string;
  confidence: number | null;
}

export interface LiveTranscriptionHandle {
  stop(): Promise<TranscriptionResult | null>;
  finished: Promise<TranscriptionResult | null>;
  abort(): void;
}

export interface LiveTranscriptionOptions {
  language: string | null;
  contextualStrings: string[];
  onError: (message: string) => void;
  onTranscript?: (text: string) => void;
  audioUri?: string;
  timeoutMs?: number;
}

type SpeechRecognitionModule = typeof import('expo-speech-recognition')['ExpoSpeechRecognitionModule'];
const STOP_TIMEOUT_MS = 8000;
let cachedModule: SpeechRecognitionModule | null | undefined;
let activeSession: LiveTranscriptionHandle | null = null;

function speechModule(): SpeechRecognitionModule | null {
  if (cachedModule === undefined) {
    cachedModule = requireOptionalNativeModule<SpeechRecognitionModule>('ExpoSpeechRecognition');
  }
  return cachedModule;
}

export function isSpeechRecognitionAvailable(): boolean {
  const module = speechModule();
  return module !== null && module.isRecognitionAvailable() && module.supportsOnDeviceRecognition();
}

export function supportsRecordedTranscription(): boolean {
  return isSpeechRecognitionAvailable() && Boolean(speechModule()?.supportsRecording());
}

export async function requestSpeechRecognitionPermission(): Promise<boolean> {
  const module = speechModule();
  if (module === null) return false;
  return (await module.requestPermissionsAsync()).granted;
}

export function startLiveTranscription(options: LiveTranscriptionOptions): LiveTranscriptionHandle {
  const module = speechModule();
  if (!module || !isSpeechRecognitionAvailable()) {
    throw new Error('On-device speech recognition is unavailable. Enable Android speech recognition and install your language in Android settings.');
  }
  if (activeSession !== null) {
    throw new Error('Another dictation is running. Stop it before starting a new one.');
  }

  const segments: string[] = [];
  let interim = '';
  let confidence: number | null = null;
  let ended = false;
  let stopping = false;
  let reportedError = false;
  let stopTimer: ReturnType<typeof setTimeout> | undefined;
  let resolveFinished!: (result: TranscriptionResult | null) => void;
  const finished = new Promise<TranscriptionResult | null>((resolve) => { resolveFinished = resolve; });
  const subscriptions: { remove(): void }[] = [];
  const text = () => [...segments, interim].filter(Boolean).join(' ').trim();

  function finish() {
    if (ended) return;
    ended = true;
    clearTimeout(stopTimer);
    subscriptions.forEach((subscription) => subscription.remove());
    activeSession = null;
    const transcript = text();
    resolveFinished(transcript ? { text: transcript, confidence } : null);
    if (!transcript && !reportedError) {
      options.onError('No speech was recognised. Check your microphone and the offline speech language in Android settings.');
    }
  }

  const handle: LiveTranscriptionHandle = {
    finished,
    stop: async () => {
      if (!ended && !stopping) {
        stopping = true;
        // The timeout begins at Stop, never while the user is still speaking.
        stopTimer = setTimeout(() => {
          finish();
          module!.abort();
        }, STOP_TIMEOUT_MS);
        try { module.stop(); } catch { finish(); }
      }
      return finished;
    },
    abort: () => {
      if (ended) return;
      reportedError = true;
      segments.length = 0;
      interim = '';
      finish();
      module.abort();
    },
  };
  activeSession = handle;
  subscriptions.push(
    module.addListener('result', (event) => {
      const result = event.results[0];
      if (!result) return;
      interim = result.transcript.trim();
      confidence = result.confidence >= 0 ? result.confidence : null;
      if (event.isFinal) {
        if (interim) segments.push(interim);
        interim = '';
      }
      options.onTranscript?.(text());
    }),
    module.addListener('end', finish),
    module.addListener('error', (event) => {
      reportedError = true;
      finish();
      options.onError(
        event.error === 'language-not-supported'
          ? 'Install the selected language for offline speech recognition in Android settings.'
          : event.message || 'Speech recognition failed. Check Android speech recognition settings.'
      );
    }),
  );
  try {
    module.start({
      lang: ({ en: 'en-US', de: 'de-DE', hu: 'hu-HU' } as Record<string, string>)[options.language ?? 'en'] ?? options.language ?? 'en-US',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: true,
      maxAlternatives: 1,
      contextualStrings: options.contextualStrings,
      ...(options.audioUri ? {
        audioSource: { uri: options.audioUri, audioChannels: 1, sampleRate: 16000, audioEncoding: 2 },
      } : {}),
    });
    if (options.audioUri && !ended) {
      stopTimer = setTimeout(() => {
        reportedError = true;
        finish();
        module.abort();
        options.onError('Transcription timed out. The recording is kept so you can retry.');
      }, options.timeoutMs ?? 300000);
    }
  } catch (error) {
    reportedError = true;
    finish();
    throw error;
  }
  return handle;
}
