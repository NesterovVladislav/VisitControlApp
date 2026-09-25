import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppDispatch, useAppSelector } from '../../store';
import { submitBiometricPreference } from '../../store/reducers/auth';

export function BiometricSetupScreen() {
  const dispatch = useAppDispatch();
  const { biometricsAvailable, isLoading } = useAppSelector((state) => state.auth);

  const submit = (enabled: boolean) => {
    dispatch(submitBiometricPreference({ enabled }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {biometricsAvailable ? 'Быстрый вход' : 'PIN-код готов'}
        </Text>
        <Text style={styles.description}>
          {biometricsAvailable
            ? 'Включите биометрию для быстрого входа. PIN-код всегда останется доступен.'
            : 'На этом устройстве подходящая биометрия недоступна. Используйте PIN-код.'}
        </Text>
        {isLoading ? (
          <ActivityIndicator color="#1D3557" size="large" />
        ) : biometricsAvailable ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => submit(true)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Включить биометрию</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => submit(false)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Не сейчас</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => submit(false)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Продолжить</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFFFFF', flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { color: '#1D3557', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  description: {
    color: '#5D6B7A',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    marginTop: 12,
    textAlign: 'center',
  },
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
