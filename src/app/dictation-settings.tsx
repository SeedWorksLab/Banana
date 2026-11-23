import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ProgressBar, Text } from 'react-native-paper';
import { ScreenFade } from '../components/screen-fade';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { OptionField } from '../components/option-field';
import { AppDialog } from '../components/app-dialog';
import { ScreenToast } from '../components/screen-toast';
import { useAppTheme } from '../theme';
import { DEFAULT_DICTATION_SETTINGS, getDictationSettings, updateDictationSettings } from '../database/dictation-settings';
import type { DictationSettings, WhisperModelId } from '../models/dictation';
import { WHISPER_MODELS } from '../dictation/model-catalog';
import { cancelModelDownload, deleteModel, downloadModel, isModelInstalled, supportsModelDownloads } from '../dictation/model-storage';
import { isWhisperAvailable } from '../dictation/whisper';

export default function DictationSettingsScreen() {
  const theme = useAppTheme();
  const [settings, setSettings] = useState(DEFAULT_DICTATION_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [installed, setInstalled] = useState<WhisperModelId[]>([]);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<WhisperModelId | null>(null);
  const [progress, setProgress] = useState(0);
  const [confirm, setConfirm] = useState<{ id: WhisperModelId; action: 'download' | 'delete' } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const available = supportsModelDownloads() && isWhisperAvailable();

  async function refreshModels() {
    const results = await Promise.all(WHISPER_MODELS.map(async (model) => await isModelInstalled(model.id) ? model.id : null));
    if (mounted.current) setInstalled(results.filter((id): id is WhisperModelId => id !== null));
  }

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const saved = await getDictationSettings();
        await refreshModels();
        if (mounted.current) { setSettings(saved); setLoaded(true); }
      } catch (error) {
        if (mounted.current) setToast(error instanceof Error ? error.message : 'Could not load dictation settings.');
      }
    })();
    return () => {
      mounted.current = false;
      void cancelModelDownload().catch(() => {});
    };
  }, []);

  async function save(patch: Partial<DictationSettings>) {
    if (locked.current || !loaded) return;
    locked.current = true;
    setBusy(true);
    try {
      const saved = await updateDictationSettings(patch);
      if (mounted.current) setSettings(saved);
    } catch (error) {
      if (mounted.current) setToast(error instanceof Error ? error.message : 'Could not save dictation settings.');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function performAction() {
    if (!confirm || locked.current) return;
    const { id, action } = confirm;
    setConfirm(null);
    locked.current = true;
    setBusy(true);
    try {
      if (action === 'download') {
        setProgress(0);
        setDownloading(id);
        await downloadModel(id, (value) => { if (mounted.current) setProgress(value); });
        if (mounted.current) setToast('Model downloaded and verified. Select Whisper to use it.');
      } else {
        await deleteModel(id);
        if (mounted.current) setToast('Model deleted. Download it again before using it for dictation.');
      }
    } catch (error) {
      if (mounted.current) setToast(error instanceof Error ? error.message : 'Model operation failed.');
    } finally {
      await refreshModels().catch(() => {});
      locked.current = false;
      if (mounted.current) { setBusy(false); setDownloading(null); }
    }
  }

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[3] }}>
        <Card>
          <Card.Content>
            <Text variant="titleMedium">Dictation</Text>
            <Text variant="bodyMedium">
              Audio stays on your phone with either engine. Whisper records first and transcribes after you tap Stop;
              it may take a while on older phones. Review names, quantities and prices before using the text.
            </Text>
            {!available ? <Text variant="bodySmall">Whisper downloads require an Android build with local speech support, not Expo Go or the web app.</Text> : null}
            {loaded && !busy ? (
              <>
                <OptionField label="Recognition engine" value={settings.engine} nullable={false}
                  options={available ? [{ value: 'android', label: 'Android (offline)' }, { value: 'whisper', label: 'Whisper (offline)' }]
                    : [{ value: 'android', label: 'Android (offline)' }]}
                  onChange={(engine) => {
                    if (engine) void save({ engine, ...(engine === 'android' && settings.language === 'auto' ? { language: 'interface' } : {}) });
                  }} />
                <OptionField label="Spoken language" value={settings.language} nullable={false}
                  options={[
                    { value: 'interface', label: 'Same as app language' },
                    { value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }, { value: 'hu', label: 'Magyar' },
                    ...(settings.engine === 'whisper' ? [{ value: 'auto' as const, label: 'Automatic detection' }] : []),
                  ]}
                  onChange={(language) => { if (language) void save({ language }); }} />
                {settings.engine === 'whisper' ? (
                  <OptionField label="Whisper model" value={settings.model} nullable={false}
                    options={WHISPER_MODELS.map((model) => ({
                      value: model.id, label: `${model.name}${installed.includes(model.id) ? ' · Installed' : ' · Download needed'}`,
                    }))}
                    onChange={(model) => { if (model) void save({ model }); }} />
                ) : null}
              </>
            ) : <Text variant="bodySmall">{busy ? 'Working…' : 'Loading settings…'}</Text>}
          </Card.Content>
        </Card>
        {WHISPER_MODELS.map((model) => (
          <Card key={model.id}>
            <Card.Content>
              <Text variant="titleMedium">{model.name} · {(model.bytes / 1000000).toFixed(1)} MB</Text>
              <Text variant="bodyMedium">
                {model.id === 'base' ? 'Recommended starting point: smaller and faster.' : 'Generally more accurate, but slower and uses more memory and battery.'}
                {' '}Multilingual, Q5_1 quantization.
              </Text>
              <Text variant="bodySmall">{installed.includes(model.id) ? 'Installed · Kept across app updates' : 'Not installed'}</Text>
              {downloading === model.id ? (
                <View style={{ gap: theme.spacing[2], marginTop: theme.spacing[3] }}>
                  <ProgressBar progress={progress} accessibilityRole="progressbar"
                    accessibilityLabel={`Downloading ${model.name}`} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} />
                  <Text variant="bodySmall">{progress >= 1 ? 'Verifying download…' : `${Math.round(progress * 100)}% downloaded`}</Text>
                  <Button accessibilityRole="button" accessibilityLabel={`Cancel ${model.name} download`} testID={`dictation-cancel-${model.id}`}
                    onPress={() => void cancelModelDownload().catch((error: unknown) => setToast(error instanceof Error ? error.message : 'Could not cancel download.'))}>
                    Cancel download
                  </Button>
                </View>
              ) : (
                <Button mode="outlined" disabled={busy || !loaded || !available}
                  accessibilityRole="button" accessibilityLabel={`${installed.includes(model.id) ? 'Delete' : 'Download'} ${model.name}`}
                  accessibilityState={{ disabled: busy || !loaded || !available }}
                  testID={`dictation-${installed.includes(model.id) ? 'delete' : 'download'}-${model.id}`}
                  onPress={() => setConfirm({ id: model.id, action: installed.includes(model.id) ? 'delete' : 'download' })}>
                  {installed.includes(model.id) ? 'Delete model' : 'Download model'}
                </Button>
              )}
            </Card.Content>
          </Card>
        ))}
        <Text variant="bodySmall">
          Downloads come from ggerganov/whisper.cpp on Hugging Face (and its download CDN); your IP address is visible to the host,
          but no audio or personal app data is sent. Wi-Fi is recommended. Models are verified before use, stored privately outside the APK,
          and excluded from backups and household sync. App updates keep them; uninstalling or clearing app storage removes them.
          Downloads stop if you leave this page; an interrupted download must be restarted.
        </Text>
      </KeyboardAwareScrollView>
      <AppDialog visible={confirm !== null} onDismiss={() => setConfirm(null)}>
        <AppDialog.Title>{confirm?.action === 'download' ? 'Download speech model?' : 'Delete speech model?'}</AppDialog.Title>
        <AppDialog.Content>
          <Text>{confirm?.action === 'download'
            ? 'This downloads the displayed model size from Hugging Face using your internet connection. No audio is uploaded.'
            : 'This removes only the downloaded model, not your recipes or other data. You will need to download it again to use it.'}</Text>
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button accessibilityRole="button" accessibilityLabel="Cancel model operation" onPress={() => setConfirm(null)}>Cancel</Button>
          <Button accessibilityRole="button" accessibilityLabel="Confirm model operation" onPress={() => void performAction()}>
            {confirm?.action === 'download' ? 'Download' : 'Delete'}
          </Button>
        </AppDialog.Actions>
      </AppDialog>
      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </ScreenFade>
  );
}
