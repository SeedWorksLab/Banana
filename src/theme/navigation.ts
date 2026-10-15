import type { Theme } from 'expo-router';
import { DarkTheme, DefaultTheme } from 'expo-router';
import type { BananaTheme } from './types';

export function buildNavigationTheme(theme: BananaTheme): Theme {
  return {
    ...(theme.scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      primary: theme.brand.primary.base,
      background: theme.surfaces.background,
      card: theme.surfaces.surface,
      text: theme.text.primary,
      border: theme.borders.border,
      notification: theme.semantic.info,
    },
  };
}
