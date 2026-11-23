import React, { useEffect, useState } from 'react';
import { Switch, Text } from 'react-native-paper';
import { View } from 'react-native';
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyLarge">Check for updates</Text>
        <Text variant="bodySmall">Check official GitHub releases when Banana starts.</Text>
      </View>
      <Switch value={enabled} disabled={!ready} onValueChange={(value) => void toggle(value)}
        accessibilityRole="switch" accessibilityLabel="Check for updates"
        accessibilityState={{ checked: enabled, disabled: !ready }} />
    </View>
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
  </>;
}
