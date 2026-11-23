import React from 'react';
import { useRouter } from 'expo-router';
import { Card, Divider, List } from 'react-native-paper';

import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { useI18n } from '../../i18n';
import { UpdateSettings } from '../../components/update-settings';
import { useAppTheme } from '../../theme';

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useI18n();

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[3] }}>
        <Card testID="settings-appearance-group">
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
        </Card>
        <Card testID="settings-pantry-group">
          <List.Item
            title={t('settings.pantry')}
            description={t('settings.pantryHint')}
            left={(props) => <List.Icon {...props} icon="fridge-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/pantry')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.pantry')}
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
        </Card>
        <Card testID="settings-account-ai-group">
          <UpdateSettings />
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
            accessibilityRole="button"
            accessibilityLabel={t('settings.ai')}
          />
          <Divider />
          <List.Item
            title="Dictation"
            description="Speech engine, spoken language and downloaded Whisper models"
            left={(props) => <List.Icon {...props} icon="microphone" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/dictation-settings' as never)}
            accessibilityRole="button"
            accessibilityLabel="Dictation"
            testID="settings-dictation"
          />
        </Card>
        <Card testID="settings-help-group">
          <List.Item
            title={t('settings.backup')}
            left={(props) => <List.Icon {...props} icon="database-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/backup')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.backup')}
          />
          <Divider />
          <List.Item
            title={t('settings.tutorial')}
            left={(props) => <List.Icon {...props} icon="school-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/tutorial?replay=1')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.tutorial')}
          />
          <Divider />
          <List.Item
            title={t('settings.whatsNew')}
            left={(props) => <List.Icon {...props} icon="gift-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/whats-new')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.whatsNew')}
          />
          <Divider />
          <List.Item
            title={t('settings.about')}
            left={(props) => <List.Icon {...props} icon="information-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/about')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.about')}
          />
        </Card>
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}
