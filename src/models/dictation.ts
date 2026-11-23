export const DICTATION_ENGINES = ['android', 'whisper'] as const;
export type DictationEngine = (typeof DICTATION_ENGINES)[number];
export const WHISPER_MODEL_IDS = ['base', 'small'] as const;
export type WhisperModelId = (typeof WHISPER_MODEL_IDS)[number];
export const DICTATION_LANGUAGES = ['interface', 'auto', 'en', 'de', 'hu'] as const;
export type DictationLanguage = (typeof DICTATION_LANGUAGES)[number];

export interface DictationSettings {
  engine: DictationEngine;
  model: WhisperModelId;
  language: DictationLanguage;
}
