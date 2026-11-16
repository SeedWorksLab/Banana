import React from 'react';
import { Stack, ThemeProvider } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider, useI18n } from '../i18n';

import { BananaThemeProvider, useAppTheme } from '../theme';
import { buildNavigationTheme } from '../theme/navigation';
import { DataProvider, useAppData } from '../data/DataProvider';
import { ShareIntentImport } from '../components/share-intent-import';

function ThemedContent() {
  const theme = useAppTheme();
  const { t } = useI18n();
  const navigationTheme = buildNavigationTheme(theme);

  return (
    <ThemeProvider value={navigationTheme}>
      <PaperProvider theme={theme}>
        <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTintColor: theme.colors.onSurface,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="seedworks" options={{ title: t('sync.title') }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="recipe/new" options={{ title: t('screen.newRecipe') }} />
          <Stack.Screen name="recipe/[id]" options={{ title: t('screen.recipe') }} />
          <Stack.Screen name="pantry" options={{ title: t('screen.pantry') }} />
          <Stack.Screen name="ingredients" options={{ title: 'Known ingredients' }} />
          <Stack.Screen name="ai-provider" options={{ title: t('screen.ai') }} />
          <Stack.Screen name="shops" options={{ title: t('settings.shops') }} />
          <Stack.Screen name="preferences-defaults" options={{ title: t('settings.preferencesDefaults') }} />
          <Stack.Screen name="backup" options={{ title: t('screen.backup') }} />
          <Stack.Screen name="tutorial" options={{ headerShown: false }} />
          <Stack.Screen name="whats-new" options={{ title: t('screen.whatsNew') }} />
          <Stack.Screen name="about" options={{ title: t('screen.about') }} />
        </Stack>
        <ShareIntentImport />
      </PaperProvider>
    </ThemeProvider>
  );
}

function ThemedApp() {
  const { settings } = useAppData();

  return (
    <I18nProvider language={settings.language}>
      <BananaThemeProvider preference={settings.themeMode}>
        <ThemedContent />
      </BananaThemeProvider>
    </I18nProvider>
  );
}

export default function RootLayout() {
  return (
    <DataProvider>
      <ThemedApp />
    </DataProvider>
  );
}
