import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Switch, Text, TextInput } from 'react-native-paper';

import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { ScreenFade } from '../components/screen-fade';
import { ScreenToast } from '../components/screen-toast';
import { useAppData } from '../data/DataProvider';

export default function AiProviderScreen() {
  const { aiState, saveAiState, clearAiCredentials } = useAppData();
  const [baseUrl, setBaseUrl] = useState(() => aiState.llmBaseUrl ?? '');
  const [apiKey, setApiKey] = useState(() => aiState.llmApiKey ?? '');
  const [model, setModel] = useState(() => aiState.llmModel ?? '');
  const [enabled, setEnabled] = useState(aiState.enabled);
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
      setToast('Saved');
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    await clearAiCredentials();
    setApiKey('');
    setToast('Credentials cleared');
  }

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Card mode="contained" style={styles.card}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.text}>
              Banana works without AI. If you enable it, a provider you choose improves how weeks are
              planned. The key stays on this device and is never included in a backup.
            </Text>
            <TextInput
              label="Base URL"
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              placeholder="https://api.openai.com/v1"
              style={styles.field}
            />
            <TextInput
              label="API key"
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              mode="outlined"
              style={styles.field}
            />
            <TextInput
              label="Model"
              value={model}
              onChangeText={setModel}
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              placeholder="gpt-4o-mini"
              style={styles.field}
            />
            <View style={styles.switchRow}>
              <Text variant="bodyLarge">Enabled</Text>
              <Switch value={enabled} onValueChange={setEnabled} />
            </View>
            {aiState.lastError ? (
              <Text variant="bodySmall" style={styles.error}>
                {aiState.lastError}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button mode="contained" loading={busy} disabled={busy} onPress={handleSave}>
                Save
              </Button>
              <Button mode="outlined" disabled={busy} onPress={handleClear}>
                Clear key
              </Button>
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
    padding: 16,
  },
  card: {},
  text: {
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
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
