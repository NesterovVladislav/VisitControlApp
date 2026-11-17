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
import { PasswordField as Field, PasswordFieldErrors, PasswordForm } from '../../store/types/profile';
import { validatePasswordField, validatePasswordForm } from '../../utils/password-validation';
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
  const [clientErrors, setClientErrors] = useState<PasswordFieldErrors>({});
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const isSubmitting = passwordStatus === 'submitting';

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
    return clientErrors[field] ?? passwordFieldErrors[field];
  }

  function setField(field: Field, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    setClientErrors((prev) => {
      const errors = { ...prev };
      delete errors[field];
      // Подтверждение сверяется с новым паролем: при его изменении проверяем заново
      if (field === 'newPassword' && prev.confirmPassword) {
        const confirmError = validatePasswordField('confirmPassword', next);
        if (confirmError) {
          errors.confirmPassword = confirmError;
        } else {
          delete errors.confirmPassword;
        }
      }
      return errors;
    });
    if (passwordFieldErrors[field]) {
      dispatch(clearPasswordFieldError(field));
    }
  }

  function validateOnBlur(field: Field) {
    // Пустое поле не ругаем при переходе дальше — только при отправке
    if (!form[field]) {
      return;
    }
    const error = validatePasswordField(field, form);
    setClientErrors((prev) => ({ ...prev, [field]: error }));
  }

  function submit() {
    if (isSubmitting) {
      return;
    }
    Keyboard.dismiss();
    const errors = validatePasswordForm(form);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
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
            onBlur={() => validateOnBlur('currentPassword')}
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
            onBlur={() => validateOnBlur('newPassword')}
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
            onBlur={() => validateOnBlur('confirmPassword')}
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

          <ActionButton label="Сменить пароль" onPress={submit} loading={isSubmitting} />
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
