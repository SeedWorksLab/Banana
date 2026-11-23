import React, { useEffect, useState } from 'react';
import { List, Switch, Text } from 'react-native-paper';
import { getUpdatePreferences, saveUpdatePreferences } from '../database/update-preferences';
import { useAppTheme } from '../theme';

export function UpdateSettings() {
  const theme = useAppTheme();
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getUpdatePreferences().then((prefs) => {
      if (active) { setEnabled(prefs.enabled); setReady(true); }
    }).catch(() => { if (active) setError('Could not read update preferences.'); });
    return () => { active = false; };
  }, []);
  async function toggle(value: boolean) {
    try { await saveUpdatePreferences({ enabled: value }); setEnabled(value); }
    catch { setError('Could not save update preferences.'); }
  }
  return <>
    <List.Item title="Check for updates" description="Check official GitHub releases when Banana starts."
      descriptionNumberOfLines={3} testID="settings-check-updates"
      style={{ borderRadius: theme.radii.pill, margin: theme.spacing[3], backgroundColor: theme.colors.surfaceVariant }}
      left={(props) => <List.Icon {...props} icon="update" />}
      right={() => <Switch value={enabled} disabled={!ready} onValueChange={(value) => void toggle(value)}
        accessibilityRole="switch" accessibilityLabel="Check for updates"
        accessibilityState={{ checked: enabled, disabled: !ready }} />}
    />
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
  </>;
}
