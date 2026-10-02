import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppDispatch, useAppSelector } from '../../store';
import { completePinSetup } from '../../store/reducers/auth';
import { PinPad } from './pin-pad';
import { makeStyles } from '../../hooks/use-palette';

export function CreatePinScreen() {
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector((state) => state.auth.isLoading);
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePin = (pin: string) => {
    if (firstPin === null) {
      setFirstPin(pin);
      setError(null);
      return;
    }
    if (firstPin !== pin) {
      setFirstPin(null);
      setError('PIN-коды не совпали. Попробуйте ещё раз');
      return;
    }
    dispatch(completePinSetup({ pin }));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {firstPin === null ? 'Создайте PIN-код' : 'Повторите PIN-код'}
        </Text>
        <Text style={styles.description}>
          Четыре цифры будут нужны для быстрого и безопасного входа
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PinPad disabled={isLoading} onSubmit={handlePin} />
        {isLoading ? <Text style={styles.status}>Сохраняем PIN-код…</Text> : null}
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
      marginBottom: 28,
      marginTop: 12,
      textAlign: 'center',
    },
    error: { color: c.danger, marginBottom: 16, textAlign: 'center' },
    status: { color: c.inkSecondary, marginTop: 16, textAlign: 'center' },
  })
);
