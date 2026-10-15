import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Portal, Text } from 'react-native-paper';

import { AppDialog } from '../components/app-dialog';
import { KeyboardAwareScrollView } from '../components/keyboard-aware-scroll-view';
import { LoadingScreen } from '../components/loading-screen';
import { ScreenFade } from '../components/screen-fade';
import { ScreenToast } from '../components/screen-toast';
import { useAppData } from '../data/DataProvider';
import { resetDatabase } from '../database/database';
import { pickBackupFile, restoreFromBackup, shareBackup } from '../utils/backup';

export default function BackupScreen() {
  const { ready, refresh } = useAppData();
  const [busy, setBusy] = useState(false);
  const [confirmUri, setConfirmUri] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (!ready) {
    return <LoadingScreen />;
  }

  async function handleExport() {
    setBusy(true);
    try {
      setToast((await shareBackup()) ? 'Backup exported' : 'Sharing is not available on this device');
    } catch {
      setToast('Could not create the backup');
    } finally {
      setBusy(false);
    }
  }

  async function handlePick() {
    setBusy(true);
    try {
      const file = await pickBackupFile();
      if (file) {
        setConfirmUri(file.uri);
      }
    } catch {
      setToast('Could not open the file picker');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    if (confirmUri === null) {
      return;
    }
    setBusy(true);
    try {
      await restoreFromBackup(confirmUri);
      await resetDatabase();
      await refresh();
      setToast('Backup restored');
    } catch {
      setToast('The backup could not be restored');
    } finally {
      setBusy(false);
      setConfirmUri(null);
    }
  }

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Card mode="contained" style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall">Export</Text>
            <Text variant="bodyMedium" style={styles.text}>
              Writes the whole database — recipes, plan, pantry, cached deals — to a single file you
              can keep or send to yourself. The AI key is left out of the backup.
            </Text>
            <Button
              mode="contained"
              icon="share-variant-outline"
              loading={busy}
              disabled={busy}
              onPress={handleExport}
              accessibilityLabel="Export backup"
            >
              Export backup
            </Button>
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall">Restore</Text>
            <Text variant="bodyMedium" style={styles.text}>
              Pick a backup file to replace the current data. This overwrites everything on this
              device, including anything recorded since the backup was taken.
            </Text>
            <Button
              mode="outlined"
              icon="folder-open-outline"
              disabled={busy}
              onPress={handlePick}
              accessibilityLabel="Choose backup file"
            >
              Choose backup file
            </Button>
          </Card.Content>
        </Card>

        <Portal>
          <AppDialog visible={confirmUri !== null} onDismiss={() => setConfirmUri(null)}>
            <AppDialog.Title>Replace current data?</AppDialog.Title>
            <AppDialog.Content>
              <Text variant="bodyMedium">
                Every recipe, plan, pantry item and cached deal currently in the app will be replaced
                with the contents of the backup. This cannot be undone.
              </Text>
            </AppDialog.Content>
            <AppDialog.Actions>
              <Button onPress={() => setConfirmUri(null)}>Cancel</Button>
              <Button loading={busy} disabled={busy} onPress={handleRestore}>
                Replace everything
              </Button>
            </AppDialog.Actions>
          </AppDialog>
        </Portal>

        <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  text: {
    marginBottom: 12,
  },
});
