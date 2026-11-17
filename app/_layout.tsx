import { DarkTheme, DefaultTheme, Theme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { Provider } from 'react-redux';

import { SessionGate } from '../components/session/session-gate';
import { WebAlertHost } from '../components/web-alert-host';
import { Palette, palettes } from '../constants/palette';
import { useScheme } from '../hooks/use-palette';
import { loadThemePreference } from '../services/theme/theme-preference';
import { syncBrowserTheme } from '../services/theme/browser-theme';
import { store } from '../store';

/** Шапки, таб-бар и фон под экранами — из той же палитры, что и сами экраны. */
function navigationTheme(base: Theme, c: Palette): Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.background,
      card: c.card,
      text: c.text,
      border: c.separator,
      notification: c.danger,
    },
  };
}

const themes = {
  light: navigationTheme(DefaultTheme, palettes.light),
  dark: navigationTheme(DarkTheme, palettes.dark),
};

export default function RootLayout() {
  const scheme = useScheme();

  // Тема, выбранная в профиле; до загрузки — как в системе
  useEffect(() => {
    void loadThemePreference();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') syncBrowserTheme(scheme);
  }, [scheme]);

  return (
    <Provider store={store}>
      <ThemeProvider value={themes[scheme]}>
        <SessionGate />
        {/* Только в браузере: там нет системного Alert. На телефоне — null */}
        <WebAlertHost />
        <StatusBar style="auto" />
      </ThemeProvider>
    </Provider>
  );
}
