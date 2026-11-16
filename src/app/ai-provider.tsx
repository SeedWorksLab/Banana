import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Switch, Text, TextInput } from 'react-native-paper';

import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { ScreenFade } from '../components/screen-fade';
import { ScreenToast } from '../components/screen-toast';
import { useAppData } from '../data/DataProvider';
import { useI18n } from '../i18n';
import { useAppTheme } from '../theme';

export default function AiProviderScreen() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const { t } = useI18n();
  const theme = useAppTheme();
  const { aiState, saveAiState, clearAiCredentials } = useAppData();
  const [baseUrl, setBaseUrl] = useState(() => aiState.llmBaseUrl ?? '');
  const [apiKey, setApiKey] = useState(() => aiState.llmApiKey ?? '');
  const [model, setModel] = useState(() => aiState.llmModel ?? '');
  const [enabled, setEnabled] = useState(onboarding === '1' ? true : aiState.enabled);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    try {
      await saveAiState({
        llmBaseUrl: baseUrl.trim() === '' ? null : baseUrl.trim(),
        llmApiKey: apiKey.trim() === '' ? null : apiKey.trim(),
        llmModel: model.trim() === '' ? null : model.trim(),
        enabled,
      });
      if (onboarding === '1') {
        router.replace('/(tabs)');
      } else {
        setToast(t('ai.saved'));
      }
    } catch {
      setToast('Could not save the AI provider');
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    await clearAiCredentials();
    setApiKey('');
    setToast(t('ai.cleared'));
  }

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={[styles.container, { padding: theme.spacing[4] }]}>
        <Card mode="contained" style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.text}>
              {t('ai.intro')}
            </Text>
            <TextInput
              label={t('ai.baseUrl')}
              accessibilityLabel={t('ai.baseUrl')}
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              style={{ marginBottom: theme.spacing[3] }}
            />
            <TextInput
              label={t('ai.apiKey')}
              accessibilityLabel={t('ai.apiKey')}
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              mode="outlined"
              style={{ marginBottom: theme.spacing[3] }}
            />
            <TextInput
              label={t('ai.model')}
              accessibilityLabel={t('ai.model')}
              value={model}
              onChangeText={setModel}
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              style={{ marginBottom: theme.spacing[3] }}
            />
            <View style={styles.switchRow}>
              <Text variant="bodyLarge">{t('ai.enabled')}</Text>
              <Switch value={enabled} onValueChange={setEnabled} accessibilityRole="switch"
                accessibilityLabel={t('ai.enabled')} accessibilityState={{ checked: enabled }} />
            </View>
            {aiState.lastError ? (
              <Text variant="bodySmall" style={styles.error}>
                {aiState.lastError}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button mode="contained" loading={busy} disabled={busy} onPress={() => void handleSave()}
                accessibilityRole="button" accessibilityLabel={onboarding === '1' ? t('ai.finish') : t('ai.save')}>
                {onboarding === '1' ? t('ai.finish') : t('ai.save')}
              </Button>
              {onboarding === '1' ? (
                <Button mode="outlined" disabled={busy} onPress={() => router.replace('/(tabs)')}
                  accessibilityRole="button" accessibilityLabel={t('ai.skip')}>{t('ai.skip')}</Button>
              ) : (
                <Button mode="outlined" disabled={busy} onPress={() => void handleClear()}
                  accessibilityRole="button" accessibilityLabel={t('ai.clear')}>{t('ai.clear')}</Button>
              )}
            </View>
          </Card.Content>
        </Card>
        <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
  },
  card: {},
  text: {
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  error: {
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
});
