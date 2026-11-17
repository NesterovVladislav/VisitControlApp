import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import { clearError, loginStart } from '../store/reducers/auth';
import { LoginCredentials } from '../store/types/auth';
import InstallHint from '../components/install-hint';
import OrganizationLogo from '../components/organization-logo';
import { ActionButton, FormCard, FormField, PasswordField, StatusMessage } from '../components/ui';
import { space, typeSize } from '../constants/ui-tokens';
import { makeStyles } from '../hooks/use-palette';
import { prefillPasswordResetEmail } from '../services/auth/password-reset-email';
import { isValidEmail } from '../utils/email-validation';

export default function AuthScreen() {
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoading, error, notice } = useAppSelector((state) => state.auth);
  // Сад последнего входа на этом устройстве; при первом запуске его нет
  const brand = useAppSelector((state) => state.organization.brand);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);

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
    if (isLoading) return;
    // Валидация полей
    if (!email.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите email');
      return;
    }

    if (!password) {
      Alert.alert('Ошибка', 'Пожалуйста, введите пароль');
      return;
    }

    // Простая валидация email
    if (!isValidEmail(email)) {
      Alert.alert('Ошибка', 'Пожалуйста, введите корректный email');
      return;
    }

    // Диспатчим action для авторизации
    const credentials: LoginCredentials = {
      email: email.trim(),
      password,
    };

    dispatch(loginStart(credentials));
  };

  return (
    // На Android с edgeToEdgeEnabled система не сжимает окно под клавиатуру, поэтому padding нужен и там.
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <FormCard>
          {brand ? (
            <View style={styles.brand}>
              <OrganizationLogo key={brand.logoUrl} name={brand.name} logoUrl={brand.logoUrl} size={72} />
              <Text style={styles.brandName} numberOfLines={2}>
                {brand.name}
              </Text>
            </View>
          ) : null}
          <Text style={styles.title} accessibilityRole="header">Авторизация</Text>

          {notice ? (
            <View style={styles.notice}>
              <StatusMessage message={notice} />
            </View>
          ) : null}
          <FormField
            label="Email"
            placeholder="Введите email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!isLoading}
          />
          <PasswordField
            ref={passwordRef}
            label="Пароль"
            placeholder="Введите пароль"
            value={password}
            onChangeText={setPassword}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            editable={!isLoading}
          />
          <View style={styles.forgot}>
            <ActionButton
              label="Забыли пароль?"
              variant="text"
              role="link"
              disabled={isLoading}
              onPress={() => {
                prefillPasswordResetEmail(email);
                router.push('./password-reset');
              }}
            />
          </View>
          <View style={styles.actions}>
            <ActionButton label="Войти" onPress={handleLogin} loading={isLoading} />
            <ActionButton
              label="Нет аккаунта? Зарегистрироваться"
              variant="text"
              role="link"
              onPress={() => router.push('/register')}
              disabled={isLoading}
            />
          </View>
          <InstallHint />
        </FormCard>
        {__DEV__ ? (
          <ActionButton label="UI Kit" variant="text" role="link" onPress={() => router.push('/ui-kit')} />
        ) : null}
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
      padding: space.xl,
    },
    brand: {
      alignItems: 'center',
      marginBottom: space.xl,
    },
    brandName: {
      marginTop: space.md,
      fontSize: typeSize.body,
      fontWeight: '600',
      textAlign: 'center',
      color: c.text,
    },
    title: {
      fontSize: typeSize.title,
      fontWeight: 'bold',
      marginBottom: space.section,
      textAlign: 'center',
      color: c.text,
    },
    notice: { marginBottom: space.lg },
    forgot: { alignItems: 'flex-end', marginTop: -space.md },
    actions: { gap: space.sm, marginTop: space.sm },
  })
);
