import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppDispatch } from '../store';
import { logoutRequested } from '../store/reducers/auth';

export default function MenuScreen() {
  const dispatch = useAppDispatch();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Меню</Text>
      <Text style={styles.subtitle}>Добро пожаловать!</Text>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => dispatch(logoutRequested({ reason: 'user' }))}
        style={styles.logoutButton}
      >
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: '#333',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    color: '#666',
    fontSize: 18,
  },
  logoutButton: {
    marginTop: 32,
    padding: 16,
  },
  logoutText: {
    color: '#B42318',
    fontSize: 17,
    fontWeight: '600',
  },
});
