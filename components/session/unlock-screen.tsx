import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppDispatch, useAppSelector } from '../../store';
import {
  logoutRequested,
  retrySessionValidation,
  unlockWithBiometrics,
  unlockWithPin,
} from '../../store/reducers/auth';
import { PinPad } from './pin-pad';
import { makeStyles, usePalette } from '../../hooks/use-palette';

export function UnlockScreen() {
  const c = usePalette();
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const {
    phase,
    isLoading,
    error,
    biometricsEnabled,
    remainingPinAttempts,
  } = useAppSelector((state) => state.auth);
  const automaticBiometricRequested = useRef(false);

  useEffect(() => {
    if (
      phase === 'locked' &&
      biometricsEnabled &&
      !automaticBiometricRequested.current
    ) {
      automaticBiometricRequested.current = true;
      dispatch(unlockWithBiometrics());
    }
  }, [biometricsEnabled, dispatch, phase]);

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
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch(logoutRequested({ reason: 'switchAccount' }))}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Войти по email и паролю</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Введите PIN-код</Text>
        {remainingPinAttempts === 1 ? (
          <Text style={styles.warning}>Последняя попытка</Text>
        ) : (
          <Text style={styles.description}>
            Осталось попыток: {remainingPinAttempts}
          </Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PinPad
          disabled={isLoading}
          onSubmit={(pin) => dispatch(unlockWithPin({ pin }))}
        />
        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={() => dispatch(logoutRequested({ reason: 'switchAccount' }))}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Войти по email и паролю</Text>
        </Pressable>
        {biometricsEnabled ? (
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => dispatch(unlockWithBiometrics())}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Использовать биометрию</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safeArea: { backgroundColor: c.card, flex: 1 },
    content: { flex: 1, justifyContent: 'center', padding: 24 },
    title: { color: c.ink, fontSize: 28, fontWeight: '700', textAlign: 'center' },
    description: { color: c.inkSecondary, marginBottom: 20, marginTop: 12, textAlign: 'center' },
    warning: { color: c.danger, fontWeight: '700', marginBottom: 20, marginTop: 12, textAlign: 'center' },
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
