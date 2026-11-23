import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { ScreenFade } from '../components/screen-fade';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { useAppData } from '../data/DataProvider';
import { getWelcomeSeen, setWelcomeSeen } from '../database/onboarding';
import { useI18n } from '../i18n';
import { useAppTheme } from '../theme';
import { HouseholdSettings } from '../components/household-settings';

export default function SeedWorksScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useI18n();
  const {
    settings, syncState, seedWorksEmail, saveSettings,
    signInSeedWorks, signOutSeedWorks, syncSeedWorks,
  } = useAppData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signIn() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await signInSeedWorks(email, password);
      setPassword('');
      if (!(await getWelcomeSeen())) {
        await setWelcomeSeen();
        await saveSettings({ tutorialSeen: true });
        router.replace('/');
      } else {
        setMessage(t('sync.complete'));
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : t('sync.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(t('sync.complete'));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : t('sync.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={[
        styles.content, { padding: theme.spacing[4], gap: theme.spacing[4] },
      ]}>
        <Card>
          <Card.Content style={{ gap: theme.spacing[3] }}>
            <Text variant="titleLarge">{t('sync.title')}</Text>
            <Text variant="bodyMedium">{t('sync.description')}</Text>
            {seedWorksEmail ? (
              <>
                <Text variant="bodyLarge">{seedWorksEmail}</Text>
                <Text variant="bodySmall">
                  {syncState.lastSyncAt ? `${t('sync.lastSync')}: ${syncState.lastSyncAt}` : t('sync.notYet')}
                </Text>
                {syncState.lastSyncError ? (
                  <Text variant="bodySmall" style={{ color: theme.semantic.error }}>
                    {syncState.lastSyncError}
                  </Text>
                ) : null}
                <TextInput
                  label={t('sync.username')}
                  value={username ?? settings.username ?? ''}
                  maxLength={80}
                  onChangeText={setUsername}
                  accessibilityLabel={t('sync.username')}
                />
                <Button mode="outlined" disabled={busy || username === null}
                  onPress={() => void run(async () => {
                    await saveSettings({ username: username?.trim() || null });
                    setUsername(null);
                    await syncSeedWorks();
                  })}
                  accessibilityRole="button" accessibilityLabel={t('sync.saveUsername')}>
                  {t('sync.saveUsername')}
                </Button>
                <Button mode="contained" icon="cloud-sync-outline" disabled={busy} loading={busy}
                  onPress={() => void run(async () => { await syncSeedWorks(); })}
                  accessibilityRole="button" accessibilityLabel={t('sync.syncNow')}>
                  {t('sync.syncNow')}
                </Button>
                <Button mode="text" disabled={busy}
                  onPress={() => void run(async () => { await signOutSeedWorks(); })}
                  accessibilityRole="button" accessibilityLabel={t('sync.signOut')}>
                  {t('sync.signOut')}
                </Button>
              </>
            ) : (
              <>
                <TextInput label={t('sync.email')} value={email} onChangeText={setEmail}
                  autoCapitalize="none" autoComplete="email" keyboardType="email-address"
                  accessibilityLabel={t('sync.email')} />
                <TextInput label={t('sync.password')} value={password} onChangeText={setPassword}
                  secureTextEntry autoComplete="password"
                  accessibilityLabel={t('sync.password')} />
                <Button mode="contained" icon="account-outline"
                  disabled={busy || !email.trim() || password.length < 6}
                  loading={busy} onPress={() => void signIn()}
                  accessibilityRole="button" accessibilityLabel={t('welcome.signIn')}>
                  {t('welcome.signIn')}
                </Button>
              </>
            )}
            {message ? <Text accessibilityRole="alert">{message}</Text> : null}
          </Card.Content>
        </Card>
        {seedWorksEmail ? <HouseholdSettings /> : null}
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
});
