import { useHeaderHeight } from '@react-navigation/elements';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ActionButton, FormCard, PasswordField, StatusMessage } from '../../components/ui';
import { space, typeSize } from '../../constants/ui-tokens';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  changePasswordStart,
  clearPasswordFieldError,
  resetPasswordChange,
} from '../../store/reducers/profile';
import { PasswordField as Field, PasswordForm } from '../../store/types/profile';
import { validatePasswordForm } from '../../utils/password-validation';
import { makeStyles } from '../../hooks/use-palette';

const EMPTY_FORM: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/**
 * Смена своего пароля. Пароли живут только в useState этого экрана. См. docs/profile-screen.md.
 */
export default function ChangePasswordScreen() {
  const styles = useStyles();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const dispatch = useAppDispatch();
  const { passwordStatus, passwordFieldErrors, passwordError } = useAppSelector((state) => state.profile);

  const [form, setForm] = useState<PasswordForm>(EMPTY_FORM);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const isSubmitting = passwordStatus === 'submitting';
  const validation = validatePasswordForm(form);
  const ready = Object.keys(validation).length === 0;

  // Каждое открытие — с чистого листа; ошибки прошлой попытки не нужны и после ухода с экрана
  useEffect(() => {
    dispatch(resetPasswordChange());
    return () => {
      dispatch(resetPasswordChange());
    };
  }, [dispatch]);

  useEffect(() => {
    if (passwordStatus === 'changed') {
      setForm(EMPTY_FORM);
      Alert.alert('Пароль изменён', 'При следующем входе используйте новый пароль.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [passwordStatus, router]);

  function errorFor(field: Field): string | undefined {
    const clientError = form[field] ? validation[field] : undefined;
    return clientError ?? passwordFieldErrors[field];
  }

  function setField(field: Field, value: string) {
    setForm(previous => ({ ...previous, [field]: value }));
    if (passwordFieldErrors[field]) {
      dispatch(clearPasswordFieldError(field));
    }
  }

  function submit() {
    if (isSubmitting || !ready) {
      return;
    }
    Keyboard.dismiss();
    dispatch(changePasswordStart({ currentPassword: form.currentPassword, newPassword: form.newPassword }));
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      // На Android с edgeToEdgeEnabled система не сжимает окно под клавиатуру, поэтому padding нужен и там.
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <FormCard>
          <PasswordField
            label="Текущий пароль"
            value={form.currentPassword}
            onChangeText={(value) => setField('currentPassword', value)}
            error={errorFor('currentPassword')}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => newPasswordRef.current?.focus()}
            editable={!isSubmitting}
          />
          <PasswordField
            ref={newPasswordRef}
            label="Новый пароль"
            value={form.newPassword}
            onChangeText={(value) => setField('newPassword', value)}
            error={errorFor('newPassword')}
            hint="Не меньше 8 символов"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            editable={!isSubmitting}
          />
          <PasswordField
            ref={confirmPasswordRef}
            label="Повторите новый пароль"
            value={form.confirmPassword}
            onChangeText={(value) => setField('confirmPassword', value)}
            error={errorFor('confirmPassword')}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={submit}
            editable={!isSubmitting}
          />

          {passwordError ? (
            <View style={styles.banner}>
              <StatusMessage message={passwordError} tone="error" />
            </View>
          ) : null}

          <ActionButton label="Сменить пароль" onPress={submit} disabled={!ready} loading={isSubmitting} />
          <Text style={styles.footer}>После смены вход на этом устройстве сохранится</Text>
        </FormCard>
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
      padding: space.xl,
      alignItems: 'center',
    },
    banner: { marginBottom: space.md },
    footer: {
      marginTop: space.lg,
      fontSize: typeSize.label,
      color: c.textSecondary,
      textAlign: 'center',
    },
  }),
);
