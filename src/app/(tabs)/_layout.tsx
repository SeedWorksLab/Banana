import React, { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { CustomTabBar } from '../../components/custom-tab-bar';
import { LoadingScreen } from '../../components/loading-screen';
import { useAppData } from '../../data/DataProvider';
import { getWelcomeSeen } from '../../database/onboarding';
import { useAppTheme } from '../../theme';
import { useI18n } from '../../i18n';

export default function TabsLayout() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const { ready, error, settings } = useAppData();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);
  const [onboardingError, setOnboardingError] = useState(false);

  useEffect(() => {
    if (ready && !error) {
      void getWelcomeSeen().then(setWelcomeSeen).catch(() => setOnboardingError(true));
    }
  }, [ready, error]);

  if (error || onboardingError) {
    return <Text accessibilityRole="alert">{error ?? 'Could not load onboarding settings'}</Text>;
  }
  if (!ready || welcomeSeen === null) {
    return <LoadingScreen />;
  }
  if (!welcomeSeen) {
    return <Redirect href={'/welcome' as never} />;
  }
  if (!settings.tutorialSeen) {
    return <Redirect href="/tutorial" />;
  }

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          sceneStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.onSurface,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: t('nav.plan') }} />
        <Tabs.Screen name="recipes" options={{ title: t('nav.recipes') }} />
        <Tabs.Screen name="shopping" options={{ title: t('nav.shopping') }} />
        <Tabs.Screen name="deals" options={{ title: t('nav.deals') }} />
        <Tabs.Screen name="settings" options={{ title: t('nav.settings') }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
