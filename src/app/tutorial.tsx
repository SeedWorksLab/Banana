import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Appbar, Button, Icon, Text } from 'react-native-paper';

import { tutorialPages } from '../config/tutorial';
import { FadeIn } from '../components/fade-in';
import { useAppData } from '../data/DataProvider';
import { useAppTheme } from '../theme';
import { useI18n } from '../i18n';
import { ScreenFade } from '../components/screen-fade';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';

export default function TutorialScreen() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const { saveSettings } = useAppData();
  const [index, setIndex] = useState(0);

  const page = tutorialPages[index];
  const isLast = index === tutorialPages.length - 1;

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const finish = async (configureAi: boolean) => {
    if (replay === '1') {
      if (configureAi) {
        router.push('/ai-provider');
      } else {
        close();
      }
      return;
    }
    await saveSettings({ tutorialSeen: true });
    router.replace(configureAi ? '/ai-provider?onboarding=1' : '/(tabs)');
  };

  const next = () => {
    if (isLast) {
      void finish(false);
    } else {
      setIndex((current) => current + 1);
    }
  };

  return (
    <ScreenFade>
      <Appbar.Header style={{ backgroundColor: theme.colors.background }}>
        {replay === '1' ? <Appbar.Action
          icon="close"
          onPress={close}
          accessibilityLabel={t('tour.close')}
          accessibilityRole="button"
        /> : null}
        <Appbar.Content title={t('tour.header')} />
      </Appbar.Header>

      <KeyboardAwareScrollView contentContainerStyle={[
        styles.content,
        { paddingHorizontal: theme.spacing[6], paddingBottom: theme.spacing[6] },
      ]}>
        <FadeIn key={index} style={styles.page}>
          <View style={[styles.iconCircle, {
            backgroundColor: theme.semantic.savingContainer,
            width: theme.spacing[10] + theme.spacing[8],
            height: theme.spacing[10] + theme.spacing[8],
            borderRadius: theme.radii.pill,
            marginBottom: theme.spacing[6],
          }]}>
            <Icon source={page.icon} size={48} color={theme.semantic.onSaving} />
          </View>
          <Text variant="titleLarge" style={styles.title}>
            {t(page.titleKey)}
          </Text>
          <Text variant="bodyLarge" style={styles.body}>
            {t(page.bodyKey)}
          </Text>
        </FadeIn>

        <View style={[styles.dots, { gap: theme.spacing[2], marginBottom: theme.spacing[6] }]}>
          {tutorialPages.map((_, dotIndex) => (
            <View
              key={dotIndex}
              style={{
                backgroundColor: dotIndex === index ? theme.colors.primary : theme.colors.onSurfaceVariant,
                borderRadius: theme.radii.pill,
                width: theme.spacing[2],
                height: theme.spacing[2],
              }}
            />
          ))}
        </View>

        <View style={[styles.navRow, { gap: theme.spacing[2] }]}>
          <Button
            mode="text"
            disabled={index === 0}
            onPress={() => setIndex((current) => Math.max(0, current - 1))}
            accessibilityRole="button"
            accessibilityLabel={t('tour.back')}
          >
            {t('tour.back')}
          </Button>
          {isLast ? (
            <View style={styles.lastActions}>
              <Button mode="outlined" onPress={() => void finish(false)}
                accessibilityRole="button" accessibilityLabel={t('tour.skipAi')}>
                {t('tour.skipAi')}
              </Button>
              <Button mode="contained" onPress={() => void finish(true)}
                accessibilityRole="button" accessibilityLabel={t('tour.configureAi')}>
                {t('tour.configureAi')}
              </Button>
            </View>
          ) : (
            <Button mode="contained" onPress={next} accessibilityRole="button"
              accessibilityLabel={t('tour.next')}>{t('tour.next')}</Button>
          )}
        </View>
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    maxWidth: 420,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
});
