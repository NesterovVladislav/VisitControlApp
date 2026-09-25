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

export function UnlockScreen() {
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
          <ActivityIndicator color="#1D3557" size="large" />
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

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFFFFF', flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { color: '#1D3557', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  description: { color: '#5D6B7A', marginBottom: 20, marginTop: 12, textAlign: 'center' },
  warning: { color: '#B42318', fontWeight: '700', marginBottom: 20, marginTop: 12, textAlign: 'center' },
  error: { color: '#B42318', marginBottom: 16, textAlign: 'center' },
  status: { color: '#5D6B7A', fontSize: 17, marginTop: 16, textAlign: 'center' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1D6FF2',
    borderRadius: 12,
    padding: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  secondaryButton: { alignItems: 'center', marginTop: 12, padding: 16 },
  secondaryButtonText: { color: '#1D6FF2', fontSize: 17, fontWeight: '600' },
});
