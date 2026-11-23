import React, { useState } from 'react';
import { Card, Text, TextInput } from 'react-native-paper';
import { ScreenFade } from '../components/screen-fade';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { NumberField } from '../components/number-field';
import { OptionField } from '../components/option-field';
import { useAppData } from '../data/DataProvider';
import { CURRENCIES, DIETS, THEME_MODES } from '../models';
import { LANGUAGES, useI18n, type Language } from '../i18n';
import { useAppTheme } from '../theme';
import { CURRENCY_LABELS, currencySymbol, formatCents, fromMinorUnits, toMinorUnits } from '../utils/currency';

const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency,
  label: CURRENCY_LABELS[currency],
}));

function splitList(text: string): string[] {
  return text.split(',').map((value) => value.trim()).filter((value) => value !== '');
}

export default function PreferencesDefaultsScreen() {
  const { settings, preferences, saveSettings, savePreferences } = useAppData();
  const { t } = useI18n();
  const theme = useAppTheme();
  const [allergiesText, setAllergiesText] = useState(() => preferences.allergies.join(', '));
  const [dislikesText, setDislikesText] = useState(() => preferences.dislikes.join(', '));
  const themeOptions = THEME_MODES.map((mode) => ({
    value: mode,
    label: mode === 'light' ? t('settings.themeLight')
      : mode === 'dark' ? t('settings.themeDark') : t('settings.themeSystem'),
  }));
  const dietOptions = DIETS.map((diet) => ({
    value: diet,
    label: diet === 'omnivore' ? t('settings.dietOmnivore')
      : diet === 'vegetarian' ? t('settings.dietVegetarian')
      : diet === 'vegan' ? t('settings.dietVegan') : t('settings.dietPescatarian'),
  }));
  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[3] }}>
        <Card>
          <Card.Content style={{ gap: theme.spacing[2] }}>
            <Text variant="titleMedium">{t('settings.appearance')}</Text>
            <OptionField label={t('settings.theme')} value={settings.themeMode}
              options={themeOptions} nullable={false}
              onChange={(value) => value !== null && void saveSettings({ themeMode: value })} />
            <OptionField label={t('settings.language')} value={settings.language}
              options={LANGUAGES.map(({ code, nativeLabel }) => ({ value: code, label: nativeLabel }))}
              nullable={false}
              onChange={(value) => value !== null && void saveSettings({ language: value as Language })} />
            <Text variant="bodySmall">{t('settings.languageHint')}</Text>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content>
            <Text variant="titleMedium">{t('settings.currency')}</Text>
            <OptionField label={t('settings.currencyLabel')} value={settings.currency}
              options={CURRENCY_OPTIONS} nullable={false}
              onChange={(value) => value !== null && void saveSettings({ currency: value })} />
            <Text variant="bodySmall">{t('settings.currencyHint')}</Text>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content>
            <Text variant="titleMedium">{t('settings.planning')}</Text>
            <NumberField label={t('settings.servings')} value={settings.defaultServings} integer
              onChange={(value) => value !== null && void saveSettings({ defaultServings: value })} />
            <NumberField label={t('settings.weeknight')} value={settings.defaultWeeknightMinutes} integer
              onChange={(value) => value !== null && void saveSettings({ defaultWeeknightMinutes: value })} />
            <NumberField label={t('settings.weekend')} value={settings.defaultWeekendMinutes} integer
              onChange={(value) => value !== null && void saveSettings({ defaultWeekendMinutes: value })} />
            <Text variant="bodySmall">{t('settings.mealDefaultsHint')}</Text>
          </Card.Content>
        </Card>
        <Card>
          <Card.Content>
            <Text variant="titleMedium">{t('settings.preferences')}</Text>
            <OptionField label={t('settings.diet')} value={preferences.diet} options={dietOptions} nullable={false}
              onChange={(value) => value !== null && void savePreferences({ diet: value })} />
            <TextInput label={t('settings.allergies')} accessibilityLabel={t('settings.allergies')}
              value={allergiesText} onChangeText={setAllergiesText}
              onBlur={() => void savePreferences({ allergies: splitList(allergiesText) })}
              mode="outlined" placeholder={t('settings.commaSeparated')} />
            <TextInput label={t('settings.dislikes')} accessibilityLabel={t('settings.dislikes')}
              value={dislikesText} onChangeText={setDislikesText}
              onBlur={() => void savePreferences({ dislikes: splitList(dislikesText) })}
              mode="outlined" placeholder={t('settings.commaSeparated')} />
            <NumberField label={t('settings.budget')} unit={currencySymbol(settings.currency)}
              value={fromMinorUnits(preferences.weeklyBudgetCents, settings.currency)}
              onChange={(value) => value !== null && void savePreferences({
                weeklyBudgetCents: toMinorUnits(value, settings.currency),
              })}
              helperText={formatCents(preferences.weeklyBudgetCents, settings.currency)} />
          </Card.Content>
        </Card>
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}
