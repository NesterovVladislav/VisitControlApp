import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppDispatch } from '../../store';
import { retryProtectedStorage } from '../../store/reducers/auth';

export function StorageErrorScreen() {
  const dispatch = useAppDispatch();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Защищённое хранилище недоступно</Text>
        <Text style={styles.description}>
          Приложение не может безопасно открыть локальную сессию. Проверьте настройки устройства и повторите.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => dispatch(retryProtectedStorage())}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Повторить</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFFFFF', flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { color: '#1D3557', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  description: {
    color: '#5D6B7A',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#1D6FF2',
    borderRadius: 12,
    padding: 16,
  },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
