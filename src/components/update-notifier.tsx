import React, { useEffect, useState } from 'react';
import { Button, Text } from 'react-native-paper';
import { AppDialog } from './app-dialog';
import { ScreenToast } from './screen-toast';
import { useAppData } from '../data/DataProvider';
import { getUpdatePreferences, saveUpdatePreferences } from '../database/update-preferences';
import { releaseInfo } from '../config/release-info';
import { checkForUpdate } from '../updates/check-for-update';
import { installUpdate } from '../updates/install-update';
import type { AppUpdate } from '../updates/update-policy';

export function UpdateNotifier() {
  const { ready } = useAppData();
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void (async () => {
      const prefs = await getUpdatePreferences();
      if (!prefs.enabled) return;
      const next = await checkForUpdate(releaseInfo.version, prefs.ignoredVersion);
      if (active) setUpdate(next);
    })().catch(() => {});
    return () => { active = false; };
  }, [ready]);

  async function ignore() {
    if (!update) return;
    try { await saveUpdatePreferences({ ignoredVersion: update.version }); setUpdate(null); }
    catch { setMessage('Could not save the ignored version.'); }
  }
  async function install() {
    if (!update || busy) return;
    setBusy(true);
    try { await installUpdate(update); setUpdate(null); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not install update.'); }
    finally { setBusy(false); }
  }
  return <>
    <AppDialog visible={update !== null} onDismiss={() => { if (!busy) setUpdate(null); }}>
      <AppDialog.Title>Banana {update?.version} is available</AppDialog.Title>
      <AppDialog.Content><Text>{busy
        ? 'Downloading. Follow progress in Android notifications. Android will ask you to confirm installation.'
        : 'Download the official APK and update without removing your data.'}</Text></AppDialog.Content>
      <AppDialog.Actions>
        <Button disabled={busy} onPress={() => setUpdate(null)}
          accessibilityRole="button" accessibilityLabel="Close update prompt">Later</Button>
        <Button disabled={busy} onPress={() => void ignore()}
          accessibilityRole="button" accessibilityLabel="Ignore this update version">Ignore version</Button>
        <Button disabled={busy} loading={busy} onPress={() => void install()}
          accessibilityRole="button" accessibilityLabel="Update now">Update now</Button>
      </AppDialog.Actions>
    </AppDialog>
    <ScreenToast visible={message !== null} message={message} onDismiss={() => setMessage(null)} />
  </>;
}
