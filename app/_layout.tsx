import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Provider } from 'react-redux';

import { SessionGate } from '../components/session/session-gate';
import { useColorScheme } from '../hooks/use-color-scheme';
import { store } from '../store';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <Provider store={store}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SessionGate />
        <StatusBar style="auto" />
      </ThemeProvider>
    </Provider>
  );
}
