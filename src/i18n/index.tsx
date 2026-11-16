import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import 'dayjs/locale/hu';

import { en, type TranslationKey } from './en';
import { de } from './de';
import { hu } from './hu';
import { DEFAULT_LANGUAGE, type Language } from './types';

export { LANGUAGES, DEFAULT_LANGUAGE, isLanguage } from './types';
export type { Language, TranslationKey };

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, de, hu };

export function translate(language: Language, key: TranslationKey): string {
  return DICTIONARIES[language][key];
}

interface I18nContextValue {
  language: Language;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  language: DEFAULT_LANGUAGE,
  t: (key) => translate(DEFAULT_LANGUAGE, key),
});

export function I18nProvider({ language, children }: { language: Language; children: React.ReactNode }) {
  useEffect(() => {
    dayjs.locale(language);
  }, [language]);
  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);
  const value = useMemo(() => ({ language, t }), [language, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
