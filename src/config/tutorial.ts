import type { TranslationKey } from '../i18n';

export interface TutorialPage {
  icon: string;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}

export const tutorialPages: TutorialPage[] = [
  {
    icon: 'silverware-fork-knife',
    titleKey: 'tour.welcomeTitle',
    bodyKey: 'tour.welcomeBody',
  },
  {
    icon: 'clock-outline',
    titleKey: 'tour.timeTitle',
    bodyKey: 'tour.timeBody',
  },
  {
    icon: 'heart-outline',
    titleKey: 'tour.wishTitle',
    bodyKey: 'tour.wishBody',
  },
  {
    icon: 'cart-outline',
    titleKey: 'tour.shoppingTitle',
    bodyKey: 'tour.shoppingBody',
  },
  {
    icon: 'sale-outline',
    titleKey: 'tour.dealsTitle',
    bodyKey: 'tour.dealsBody',
  },
  {
    icon: 'shield-lock-outline',
    titleKey: 'tour.privacyTitle',
    bodyKey: 'tour.privacyBody',
  },
  {
    icon: 'creation-outline',
    titleKey: 'tour.aiTitle',
    bodyKey: 'tour.aiBody',
  },
];
