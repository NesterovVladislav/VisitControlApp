import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  logoutRequested,
  retrySessionValidation,
  unlockWithBiometrics,
} from '../../store/reducers/auth';
import { makeStyles, usePalette } from '../../hooks/use-palette';

/**
 * Браузерная версия unlock-screen.tsx. PIN-кода в браузере нет: разблокировка только по Face ID,
 * запасной путь — вход по паролю. Face ID не запускается сам при открытии экрана: Safari показывает
 * окно Face ID только в ответ на нажатие.
 */
export function UnlockScreen() {
  const c = usePalette();
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const { phase, isLoading, error, biometricsEnabled } = useAppSelector((state) => state.auth);

  const loginWithPassword = (
    <Pressable
      accessibilityRole="button"
      disabled={isLoading}
      onPress={() => dispatch(logoutRequested({ reason: 'switchAccount' }))}
      style={styles.secondaryButton}
    >
      <Text style={styles.secondaryButtonText}>Войти по email и паролю</Text>
    </Pressable>
  );

  if (phase === 'validating') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ActivityIndicator color={c.ink} size="large" />
          <Text style={styles.status}>Проверяем сессию</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'validationUnavailable') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Не удалось проверить сессию</Text>
          <Text style={styles.description}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch(retrySessionValidation())}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Повторить проверку</Text>
          </Pressable>
          {loginWithPassword}
        </View>
      </SafeAreaView>
    );
  }

  if (!biometricsEnabled) {
    // Приложение долго было свёрнуто, а быстрый вход не включён: токен только в памяти, войти можно паролем
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Сессия закрыта</Text>
          <Text style={styles.description}>
            Приложение долго было свёрнуто. Войдите снова.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => dispatch(logoutRequested({ reason: 'switchAccount' }))}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Войти</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>ДоброВход</Text>
        <Text style={styles.description}>Подтвердите вход по Face ID или Touch ID</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {isLoading ? (
          <ActivityIndicator color={c.ink} size="large" />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch(unlockWithBiometrics())}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Разблокировать</Text>
          </Pressable>
        )}
        {loginWithPassword}
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safeArea: { backgroundColor: c.card, flex: 1 },
    content: { flex: 1, justifyContent: 'center', padding: 24 },
    title: { color: c.ink, fontSize: 28, fontWeight: '700', textAlign: 'center' },
    description: { color: c.inkSecondary, fontSize: 16, marginBottom: 24, marginTop: 12, textAlign: 'center' },
    error: { color: c.danger, marginBottom: 16, textAlign: 'center' },
    status: { color: c.inkSecondary, fontSize: 17, marginTop: 16, textAlign: 'center' },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: c.accent,
      borderRadius: 12,
      padding: 16,
    },
    primaryButtonText: { color: c.onPrimary, fontSize: 17, fontWeight: '600' },
    secondaryButton: { alignItems: 'center', marginTop: 12, padding: 16 },
    secondaryButtonText: { color: c.accent, fontSize: 17, fontWeight: '600' },
  })
);
