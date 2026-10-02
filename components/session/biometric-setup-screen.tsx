import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppDispatch, useAppSelector } from '../../store';
import { submitBiometricPreference } from '../../store/reducers/auth';
import { makeStyles, usePalette } from '../../hooks/use-palette';

export function BiometricSetupScreen() {
  const c = usePalette();
  const styles = useStyles();
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
          <ActivityIndicator color={c.ink} size="large" />
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

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    safeArea: { backgroundColor: c.card, flex: 1 },
    content: { flex: 1, justifyContent: 'center', padding: 24 },
    title: { color: c.ink, fontSize: 28, fontWeight: '700', textAlign: 'center' },
    description: {
      color: c.inkSecondary,
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 32,
      marginTop: 12,
      textAlign: 'center',
    },
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
