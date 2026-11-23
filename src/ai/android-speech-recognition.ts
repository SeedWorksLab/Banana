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
  onProcessing?: (processing: boolean) => void;
  audioUri?: string;
  timeoutMs?: number;
}

type SpeechRecognitionModule = typeof import('expo-speech-recognition')['ExpoSpeechRecognitionModule'];
const STOP_TIMEOUT_MS = 8000;
let cachedModule: SpeechRecognitionModule | null | undefined;
let activeSession: LiveTranscriptionHandle | null = null;
const preparedLocales = new Map<string, string>();

export function selectSpeechLocale(language: string | null, installed: readonly string[]): string {
  const requested = ({ en: 'en-US', de: 'de-DE', hu: 'hu-HU' } as Record<string, string>)[language ?? 'en']
    ?? language ?? 'en-US';
  const normalize = (value: string) => value.replace(/_/g, '-').toLowerCase();
  const exact = installed.find((value) => normalize(value) === normalize(requested));
  const sameLanguage = installed.find((value) => normalize(value).split('-')[0] === normalize(requested).split('-')[0]);
  return (exact ?? sameLanguage ?? requested).replace(/_/g, '-');
}

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

export async function requestSpeechRecognitionPermission(language: string | null = null): Promise<boolean> {
  const module = speechModule();
  if (module === null) return false;
  if (!(await module.requestPermissionsAsync()).granted) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const supported = await Promise.race([
      module.getSupportedLocales({}),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Locale query timed out')), 4000); }),
    ]);
    preparedLocales.set(language ?? '', selectSpeechLocale(language, supported.installedLocales));
  } catch {
    preparedLocales.set(language ?? '', selectSpeechLocale(language, []));
  } finally { clearTimeout(timer); }
  return true;
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
    options.onProcessing?.(false);
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
        options.onProcessing?.(true);
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
          ? 'The Android on-device recognizer could not use this speech language. Other apps may use online dictation. Check the offline languages in Android speech settings.'
          : event.message || 'Speech recognition failed. Check Android speech recognition settings.'
      );
    }),
  );
  try {
    module.start({
      lang: preparedLocales.get(options.language ?? '') ?? selectSpeechLocale(options.language, []),
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
