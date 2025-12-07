import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import { clearError, loginStart } from '../store/reducers/auth';
import { LoginCredentials } from '../store/types/auth';

export default function AuthScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoading, error, isAuthenticated } = useAppSelector(
    (state) => state.auth
  );

  // Отладочное логирование состояния
  useEffect(() => {
    console.log('[Auth Screen] State changed:', { isLoading, error, isAuthenticated });
  }, [isLoading, error, isAuthenticated]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Навигация на меню при успешной авторизации
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/menu');
    }
  }, [isAuthenticated, router]);

  // Показываем Alert при ошибке
  useEffect(() => {
    if (error) {
      Alert.alert('Ошибка авторизации', error, [
        {
          text: 'OK',
          onPress: () => {
            dispatch(clearError());
          },
        },
      ]);
    }
  }, [error, dispatch]);

  const handleLogin = () => {
    console.log('[Auth Screen] Handle login called');

    // Валидация полей
    if (!email.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите email');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите пароль');
      return;
    }

    // Простая валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Ошибка', 'Пожалуйста, введите корректный email');
      return;
    }

    // Диспатчим action для авторизации
    const credentials: LoginCredentials = {
      email: email.trim(),
      password: password.trim(),
    };

    console.log('[Auth Screen] Dispatching loginStart with:', credentials);
    const action = loginStart(credentials);
    console.log('[Auth Screen] Action:', action);
    dispatch(action);
  };

  const isFormDisabled = isLoading;

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Авторизация</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, isFormDisabled && styles.inputDisabled]}
            placeholder="Введите email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isFormDisabled}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Пароль</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                isFormDisabled && styles.inputDisabled,
              ]}
              placeholder="Введите пароль"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isFormDisabled}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
              disabled={isFormDisabled}
            >
              <Text style={styles.eyeButtonText}>
                {showPassword ? 'Скрыть' : 'Показать'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, isFormDisabled && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isFormDisabled}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Войти</Text>
          )}
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
  form: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 80,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  eyeButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 50,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
