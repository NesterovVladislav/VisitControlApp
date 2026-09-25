import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppDispatch } from '../store';
import { resetRegistration } from '../store/reducers/registration';

export default function RegistrationSentScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const handleDone = () => {
    dispatch(resetRegistration());
    router.dismissTo('/auth');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon} accessibilityElementsHidden>
          ✉️
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          Заявка отправлена
        </Text>
        <Text style={styles.text}>
          Администратор сада проверит данные. После подтверждения
          {email ? (
            <>
              {' '}на <Text style={styles.email}>{email}</Text>
            </>
          ) : null}{' '}
          придёт письмо с паролем для входа.
        </Text>
        <Text style={styles.note}>
          Если письмо долго не приходит, проверьте папку «Спам» или обратитесь к администратору сада.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleDone} accessibilityRole="button">
          <Text style={styles.buttonText}>Понятно</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  text: {
    fontSize: 16,
    lineHeight: 23,
    color: '#333',
    marginBottom: 12,
  },
  email: {
    fontWeight: '600',
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
