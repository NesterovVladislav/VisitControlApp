import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppDispatch } from '../store';
import { logoutRequested } from '../store/reducers/auth';
import { makeStyles } from '../hooks/use-palette';

export default function MenuScreen() {
  const styles = useStyles();
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

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      backgroundColor: c.background,
      flex: 1,
      justifyContent: 'center',
      padding: 20,
    },
    title: {
      color: c.text,
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: 18,
    },
    logoutButton: {
      marginTop: 32,
      padding: 16,
    },
    logoutText: {
      color: c.danger,
      fontSize: 17,
      fontWeight: '600',
    },
  })
);
