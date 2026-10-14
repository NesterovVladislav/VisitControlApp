import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import { clearError, loginStart } from '../store/reducers/auth';
import { LoginCredentials } from '../store/types/auth';
import InstallHint from '../components/install-hint';
import OrganizationLogo from '../components/organization-logo';
import { makeStyles, usePalette } from '../hooks/use-palette';

export default function AuthScreen() {
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoading, error, notice } = useAppSelector((state) => state.auth);
  // Сад последнего входа на этом устройстве; при первом запуске его нет
  const brand = useAppSelector((state) => state.organization.brand);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

    dispatch(loginStart(credentials));
  };

  const isFormDisabled = isLoading;

  return (
    // На Android с edgeToEdgeEnabled система не сжимает окно под клавиатуру, поэтому padding нужен и там.
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {/* Только в браузере на iPhone; на телефоне и в установленном PWA — ничего */}
          <InstallHint />
          {brand ? (
            <View style={styles.brand}>
              <OrganizationLogo key={brand.logoUrl} name={brand.name} logoUrl={brand.logoUrl} size={72} />
              <Text style={styles.brandName} numberOfLines={2}>
                {brand.name}
              </Text>
            </View>
          ) : null}
          <Text style={styles.title}>Авторизация</Text>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, isFormDisabled && styles.inputDisabled]}
              placeholder="Введите email"
              placeholderTextColor={c.placeholder}
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
                placeholderTextColor={c.placeholder}
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
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Войти</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/register')}
            disabled={isFormDisabled}
            accessibilityRole="link"
          >
            <Text style={styles.registerText}>
              Нет аккаунта? <Text style={styles.registerTextAccent}>Зарегистрироваться</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    form: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 24,
      shadowColor: c.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    brand: {
      alignItems: 'center',
      marginBottom: 20,
    },
    brandName: {
      marginTop: 10,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      color: c.text,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 32,
      textAlign: 'center',
      color: c.text,
    },
    notice: {
      color: c.inkSecondary,
      marginBottom: 20,
      textAlign: 'center',
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      color: c.text,
    },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: c.card,
      color: c.text,
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
      color: c.primary,
      fontSize: 14,
      fontWeight: '500',
    },
    inputDisabled: {
      backgroundColor: c.fill,
      color: c.textTertiary,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      minHeight: 50,
    },
    buttonDisabled: {
      backgroundColor: c.disabled,
    },
    buttonText: {
      color: c.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    registerLink: {
      marginTop: 20,
      alignItems: 'center',
    },
    registerText: {
      fontSize: 14,
      color: c.textSecondary,
    },
    registerTextAccent: {
      color: c.primary,
      fontWeight: '500',
    },
  })
);
