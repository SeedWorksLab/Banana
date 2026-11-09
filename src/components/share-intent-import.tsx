import React, { useState } from 'react';
import { Button, Snackbar, Text } from 'react-native-paper';
import { useShareIntent } from 'expo-share-intent';

import { AppDialog } from './app-dialog';
import { useAppData } from '../data/DataProvider';
import { parseTicketText } from '../services/ticket-service';

export function ShareIntentImport() {
  const [dismissedText, setDismissedText] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent({
    onResetShareIntent: () => setDismissedText(null),
  });
  const { importTicket } = useAppData();

  const incoming = hasShareIntent && shareIntent.text ? shareIntent.text : null;
  const text = incoming !== null && incoming !== dismissedText ? incoming : null;
  const message = snack ?? (error !== null && error !== dismissedError ? error : null);
  const lines = text === null ? [] : parseTicketText(text);

  const close = () => {
    setDismissedText(incoming);
    resetShareIntent();
  };

  const handleImport = async () => {
    if (text === null) {
      return;
    }
    setBusy(true);
    try {
      const result = await importTicket(text);
      const unmatched =
        result.unmatched.length > 0 ? `, ${result.unmatched.length} not matched` : '';
      setSnack(`Added ${result.matched.length} items to the pantry${unmatched}`);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppDialog visible={text !== null} onDismiss={close}>
        <AppDialog.Title>Lidl ticket</AppDialog.Title>
        <AppDialog.Content>
          <Text variant="bodyMedium">
            Found {lines.length} item{lines.length === 1 ? '' : 's'} in the shared ticket.
          </Text>
          <Text variant="bodySmall">
            Matched items are marked as stocked in your pantry.
          </Text>
        </AppDialog.Content>
        <AppDialog.Actions>
          <Button onPress={close}>Cancel</Button>
          <Button
            loading={busy}
            disabled={busy || lines.length === 0}
            onPress={handleImport}
          >
            Add to pantry
          </Button>
        </AppDialog.Actions>
      </AppDialog>
      <Snackbar
        visible={message !== null}
        onDismiss={() => {
          setSnack(null);
          setDismissedError(error);
        }}
        duration={4000}
      >
        {message ?? ''}
      </Snackbar>
    </>
  );
}
