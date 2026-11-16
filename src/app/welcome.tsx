import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, SegmentedButtons, Text } from 'react-native-paper';
import { BananaLogo } from '../components/banana-logo';
import { ScreenFade } from '../components/screen-fade';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { useAppData } from '../data/DataProvider';
import { setWelcomeSeen } from '../database/onboarding';
import { LANGUAGES, useI18n, type Language } from '../i18n';
import { useAppTheme } from '../theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useI18n();
  const { settings, saveSettings } = useAppData();
  const [busy, setBusy] = useState(false);

  async function startFresh() {
    setBusy(true);
    try {
      await setWelcomeSeen();
      router.replace('/tutorial');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={[styles.container, { padding: theme.spacing[6] }]}>
        <View style={[styles.content, { gap: theme.spacing[6] }]}>
          <View style={[styles.hero, { gap: theme.spacing[3] }]}>
            <BananaLogo size={72} />
            <Text variant="headlineMedium">{t('welcome.title')}</Text>
            <Text variant="bodyLarge" style={{ color: theme.text.secondary }}>{t('welcome.intro')}</Text>
          </View>
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="titleMedium">{t('welcome.language')}</Text>
            <Text variant="bodySmall">{t('welcome.languageHint')}</Text>
            <SegmentedButtons
              value={settings.language}
              onValueChange={(value) => void saveSettings({ language: value as Language })}
              buttons={LANGUAGES.map((language) => ({
                value: language.code,
                label: language.nativeLabel,
                accessibilityLabel: language.nativeLabel,
              }))}
            />
          </View>
          <View style={{ gap: theme.spacing[3] }}>
            <Button mode="contained" icon="account-outline" disabled={busy}
              onPress={() => router.push('/seedworks' as never)} accessibilityRole="button"
              accessibilityLabel={t('welcome.signIn')}>
              {t('welcome.signIn')}
            </Button>
            <Text variant="bodySmall" style={{ color: theme.text.secondary }}>{t('welcome.accountHint')}</Text>
            <Button mode="outlined" icon="sprout-outline" disabled={busy} loading={busy}
              onPress={() => void startFresh()} accessibilityRole="button"
              accessibilityLabel={t('welcome.startFresh')}>
              {t('welcome.startFresh')}
            </Button>
            <Text variant="bodySmall" style={{ color: theme.text.secondary }}>{t('welcome.freshHint')}</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  hero: { alignItems: 'center' },
});
