import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme } from './light';
import { darkTheme } from './dark';
import type { BananaTheme, ThemeMode, ThemePreference } from './types';

const ThemeContext = createContext<BananaTheme>(lightTheme);

interface BananaThemeProviderProps {
  readonly children: ReactNode;
  readonly preference?: ThemePreference;
}

export function BananaThemeProvider({
  children,
  preference = 'system',
}: BananaThemeProviderProps) {
  const systemScheme = useColorScheme();
  const scheme: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): BananaTheme {
  return useContext(ThemeContext);
}

export { lightTheme, darkTheme };
export type { BananaTheme, ThemeMode, ThemePreference, ThemeColors, BrandTokens } from './types';
