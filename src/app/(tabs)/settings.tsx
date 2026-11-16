import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Divider, List, Switch, Text } from 'react-native-paper';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { ScreenToast } from '../../components/screen-toast';
import { OptionField } from '../../components/option-field';
import { useAppData } from '../../data/DataProvider';
import { CURRENCIES, THEME_MODES } from '../../models';
import { requestNotificationPermission } from '../../services/notifications';
import { LANGUAGES, useI18n, type Language } from '../../i18n';
import { CURRENCY_LABELS } from '../../utils/currency';

const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency,
  label: CURRENCY_LABELS[currency],
}));

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const themeOptions = THEME_MODES.map((mode) => ({
    value: mode,
    label: mode === 'light' ? t('settings.themeLight')
      : mode === 'dark' ? t('settings.themeDark') : t('settings.themeSystem'),
  }));
  const {
    settings,
    saveSettings,
  } = useAppData();
  const [toast, setToast] = useState<string | null>(null);

  async function toggleNotifications(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setToast(t('settings.notificationsBlocked'));
        await saveSettings({ notificationsEnabled: false });
        return;
      }
    }
    await saveSettings({ notificationsEnabled: value });
  }

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <Card>
          <Card.Content>
            <Text variant="titleMedium">{t('settings.appearance')}</Text>
            <OptionField
              label={t('settings.theme')}
              value={settings.themeMode}
              options={themeOptions}
              nullable={false}
              onChange={(value) => value !== null && void saveSettings({ themeMode: value })}
            />
            <OptionField
              label={t('settings.language')}
              value={settings.language}
              options={LANGUAGES.map(({ code, nativeLabel }) => ({ value: code, label: nativeLabel }))}
              nullable={false}
              onChange={(value) => value !== null && void saveSettings({ language: value as Language })}
            />
            <Text variant="bodySmall">{t('settings.languageHint')}</Text>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            <Text variant="titleMedium">{t('settings.currency')}</Text>
            <OptionField
              label={t('settings.currencyLabel')}
              value={settings.currency}
              options={CURRENCY_OPTIONS}
              nullable={false}
              onChange={(value) => value !== null && void saveSettings({ currency: value })}
            />
            <Text variant="bodySmall">
              {t('settings.currencyHint')}
            </Text>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            <Text variant="titleMedium">{t('settings.reminders')}</Text>
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text variant="bodyLarge">{t('settings.planUpdates')}</Text>
                <Text variant="bodySmall">
                  {t('settings.planUpdatesHint')}
                </Text>
              </View>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(value) => void toggleNotifications(value)}
                accessibilityLabel={t('settings.planUpdates')}
                accessibilityState={{ checked: settings.notificationsEnabled }}
              />
            </View>
          </Card.Content>
        </Card>

        <Card>
          <List.Item
            title={t('settings.preferencesDefaults')}
            description={t('settings.preferencesDefaultsHint')}
            left={(props) => <List.Icon {...props} icon="tune" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/preferences-defaults')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.preferencesDefaults')}
            testID="settings-preferences-defaults"
          />
          <Divider />
          <List.Item
            title={t('settings.shops')}
            description={t('settings.shopsMenuHint')}
            left={(props) => <List.Icon {...props} icon="storefront-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/shops')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.shops')}
            testID="settings-shops"
          />
          <Divider />
          <List.Item
             title={t('settings.pantry')}
             description={t('settings.pantryHint')}
            left={(props) => <List.Icon {...props} icon="fridge-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/pantry')}
          />
          <Divider />
          <List.Item
            title="Known ingredients"
            description="Add ingredients and correct their names, units and details"
            left={(props) => <List.Icon {...props} icon="food-variant" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/ingredients')}
            accessibilityRole="button"
            accessibilityLabel="Known ingredients"
          />
          <Divider />
          <List.Item
             title={t('sync.title')}
             description={t('sync.description')}
            left={(props) => <List.Icon {...props} icon="cloud-sync-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/seedworks' as never)}
            accessibilityRole="button"
            accessibilityLabel={t('sync.title')}
           />
           <Divider />
           <List.Item
             title={t('settings.ai')}
             description={t('settings.aiHint')}
            left={(props) => <List.Icon {...props} icon="robot-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/ai-provider')}
          />
          <Divider />
          <List.Item
             title={t('settings.backup')}
            left={(props) => <List.Icon {...props} icon="database-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/backup')}
          />
          <Divider />
          <List.Item
             title={t('settings.tutorial')}
            left={(props) => <List.Icon {...props} icon="school-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/tutorial?replay=1')}
          />
          <Divider />
          <List.Item
             title={t('settings.whatsNew')}
            left={(props) => <List.Icon {...props} icon="gift-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/whats-new')}
          />
          <Divider />
          <List.Item
             title={t('settings.about')}
            left={(props) => <List.Icon {...props} icon="information-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/about')}
          />
        </Card>
      </KeyboardAwareScrollView>
      <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  flex: {
    flex: 1,
  },
});
