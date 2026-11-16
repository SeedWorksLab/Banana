import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';
import { hu } from '../../src/i18n/hu';
import { translate } from '../../src/i18n';
import { isLanguage, LANGUAGES } from '../../src/i18n/types';
import { tutorialPages } from '../../src/config/tutorial';

describe('interface languages', () => {
  it('recognises only supported language codes', () => {
    expect(LANGUAGES.map((language) => language.code)).toEqual(['en', 'de', 'hu']);
    expect(isLanguage('de')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
  });

  it('keeps each dictionary complete', () => {
    const keys = Object.keys(en).sort();
    expect(Object.keys(de).sort()).toEqual(keys);
    expect(Object.keys(hu).sort()).toEqual(keys);
  });

  it('localizes the first-run steps and navigation', () => {
    expect(translate('de', 'welcome.startFresh')).toBe('Neu anfangen');
    expect(translate('hu', 'tour.configureAi')).toBe('MI beállítása');
    expect(translate('en', 'nav.shopping')).toBe('Shopping');
    for (const page of tutorialPages) {
      for (const language of LANGUAGES) {
        expect(translate(language.code, page.titleKey)).toBeTruthy();
        expect(translate(language.code, page.bodyKey)).toBeTruthy();
      }
    }
  });
});
