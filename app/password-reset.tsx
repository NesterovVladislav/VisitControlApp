import { getDefaultHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, CodeField, FormCard, FormField, PasswordField, StatusMessage } from '../components/ui';
import { IconSymbol } from '../components/ui/icon-symbol';
import { controlHeight, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { formatCountdown, usePasswordReset } from '../hooks/use-password-reset';
import { useAppDispatch, useAppSelector } from '../store';
import { passwordResetSignIn } from '../store/reducers/auth';
import { MIN_PASSWORD_BYTES, PASSWORD_MESSAGES, validatePasswordField } from '../utils/password-validation';

const TITLE = {
  email: 'Сброс пароля',
  code: 'Код из письма',
  password: 'Новый пароль',
  expired: 'Получить новый код',
  uncertain: 'Смена пароля',
  success: 'Пароль изменён',
};

type Reset = ReturnType<typeof usePasswordReset>;

export default function PasswordResetScreen() {
  const reset = usePasswordReset();
  const styles = useStyles();
  const dimensions = useWindowDimensions();
  const headerHeight = Math.max(controlHeight.touch, getDefaultHeaderHeight(dimensions, false, 0));
  const router = useRouter();
  const dispatch = useAppDispatch();
  const signingIn = useAppSelector((state) => state.auth.isLoading);
  const { step, goToEmail } = reset;

  const exit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/auth');
  }, [router]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (signingIn) return true;
      if (step.name === 'email' || step.name === 'success' || step.name === 'uncertain') return false;
      goToEmail();
      return true;
    });
    return () => subscription.remove();
  }, [goToEmail, signingIn, step.name]));

  const success = step.name === 'success';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      {!success ? (
        <View style={[styles.header, { minHeight: headerHeight }]}>
          <View style={styles.back}>
            <ActionButton
              label="Назад"
              variant="text"
              onPress={step.name === 'email' || step.name === 'uncertain' ? exit : goToEmail}
            />
          </View>
          <Text accessibilityRole="header" style={styles.headerTitle}>{TITLE[step.name]}</Text>
        </View>
      ) : null}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          key={step.name}
          contentContainerStyle={[styles.content, success && styles.center]}
          keyboardShouldPersistTaps="handled"
        >
          {step.name === 'email' && <EmailStep reset={reset} />}
          {step.name === 'code' && <CodeStep key={step.expiresAt} reset={reset} />}
          {step.name === 'password' && <NewPasswordStep reset={reset} />}
          {step.name === 'expired' && <ExpiredStep reset={reset} />}
          {step.name === 'uncertain' && (
            <FormCard>
              <View style={styles.stack}>
                <StatusMessage
                  tone="error"
                  message="Не удалось получить подтверждение. Попробуйте войти с новым паролем или запросите новый код."
                />
                <ActionButton label="Перейти ко входу" onPress={exit} />
                <ActionButton label="Получить новый код" variant="text" onPress={goToEmail} />
              </View>
            </FormCard>
          )}
          {step.name === 'success' && (
            <SuccessStep
              loading={signingIn}
              onContinue={() => dispatch(passwordResetSignIn({ accessToken: step.accessToken }))}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EmailStep({ reset }: { reset: Reset }) {
  const styles = useStyles();
  return (
    <FormCard>
      <Text style={styles.intro}>
        Укажите email, с которым вы входите в приложение. Мы отправим на него код для смены пароля.
      </Text>
      <FormField
        label="Email"
        placeholder="Введите email"
        value={reset.email}
        onChangeText={reset.editEmail}
        keyboardType="email-address"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={reset.requestCode}
        editable={!reset.busy}
        hint={reset.prefilled ? 'Подставлен с экрана входа' : undefined}
        error={reset.fieldError}
      />
      <View style={styles.stack}>
        {reset.message && <StatusMessage message={reset.message} tone="error" />}
        <ActionButton
          label="Получить код"
          onPress={reset.requestCode}
          disabled={!reset.canRequest}
          loading={reset.busy === 'request'}
        />
        <Text style={[styles.caption, styles.centerText]}>Забыли и email? Обратитесь к администратору сада.</Text>
      </View>
    </FormCard>
  );
}

function CodeStep({ reset }: { reset: Reset }) {
  const styles = useStyles();
  const [code, setCode] = useState('');
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (!reset.fieldError) return;
    const timeout = setTimeout(() => {
      setCode('');
      input.current?.focus();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [reset.fieldError]);

  function changeCode(value: string) {
    setCode(value);
    if (reset.fieldError) reset.clearFieldError();
    if (value.length === 6) reset.verifyCode(value);
  }

  return (
    <>
      <FormCard>
        <View style={styles.stack}>
          <Text style={[styles.body, styles.centerText]}>
            Если учётная запись активна, шестизначный код придёт на{' '}
            <Text style={styles.emphasis}>{reset.email}</Text>
          </Text>
          <Text style={[styles.caption, styles.centerText]}>
            Код действует ещё {formatCountdown(reset.codeSeconds)}
          </Text>
          <CodeField
            inputRef={input}
            label="Код из письма"
            value={code}
            onChangeText={changeCode}
            error={reset.fieldError}
            disabled={Boolean(reset.busy)}
          />
          <Text style={[styles.caption, styles.centerText]}>Можно вставить все шесть цифр из письма.</Text>
          {reset.message && <StatusMessage message={reset.message} tone="error" />}
          <ActionButton
            label="Продолжить"
            onPress={() => reset.verifyCode(code)}
            disabled={code.length !== 6 || !reset.canSubmit || Boolean(reset.fieldError) || reset.busy === 'request'}
            loading={reset.busy === 'verify'}
          />
          <ActionButton
            label={reset.resendSeconds
              ? `Отправить код ещё раз через ${formatCountdown(reset.resendSeconds)}`
              : 'Отправить код ещё раз'}
            variant="text"
            onPress={reset.requestCode}
            disabled={reset.resendSeconds > 0 || Boolean(reset.busy)}
          />
          <ActionButton label="Изменить email" variant="text" onPress={reset.changeEmail} />
        </View>
      </FormCard>
      <FormCard>
        <Text style={[styles.body, styles.emphasis]}>Письма нет?</Text>
        <Text style={[styles.caption, styles.help]}>Проверьте папку «Спам» и правильность email. Код приходит на адрес активной учётной записи.</Text>
      </FormCard>
    </>
  );
}

function NewPasswordStep({ reset }: { reset: Reset }) {
  const styles = useStyles();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const confirmationInput = useRef<TextInput>(null);
  const fields = { currentPassword: '', newPassword: password, confirmPassword: confirmation };
  const passwordError = password
    ? password.length < MIN_PASSWORD_BYTES ? PASSWORD_MESSAGES.length : validatePasswordField('newPassword', fields)
    : undefined;
  const matchError = confirmation ? validatePasswordField('confirmPassword', fields) : undefined;
  const valid = Boolean(password && confirmation && !passwordError && !matchError);

  function submit() {
    if (valid) reset.confirmPassword(password);
  }

  return (
    <FormCard>
      <Text style={styles.intro}>Придумайте новый пароль для <Text style={styles.emphasis}>{reset.email}</Text>.</Text>
      <PasswordField
        label="Новый пароль"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (reset.fieldError) reset.clearFieldError();
        }}
        error={passwordError ?? reset.fieldError}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        editable={!reset.busy}
        onSubmitEditing={() => confirmationInput.current?.focus()}
      />
      <PasswordField
        ref={confirmationInput}
        label="Повторите пароль"
        value={confirmation}
        onChangeText={setConfirmation}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        editable={!reset.busy}
        onSubmitEditing={submit}
        error={matchError}
      />
      <View style={styles.stack}>
        <View style={styles.rules}>
          <Text style={password && !passwordError ? styles.met : styles.caption}>
            {password && !passwordError ? '✓ ' : ''}Не короче 8 символов
          </Text>
          <Text style={confirmation && !matchError ? styles.met : styles.caption}>
            {confirmation && !matchError ? '✓ Пароли совпадают' : 'Пароли должны совпадать'}
          </Text>
        </View>
        {reset.message && <StatusMessage message={reset.message} tone="error" />}
        <ActionButton
          label="Сохранить и войти"
          disabled={!valid || !reset.canSubmit}
          loading={reset.busy === 'confirm'}
          onPress={submit}
        />
      </View>
    </FormCard>
  );
}

function ExpiredStep({ reset }: { reset: Reset }) {
  const styles = useStyles();
  return (
    <FormCard>
      <View style={styles.stack}>
        <CodeField label="Код из письма" value="" onChangeText={() => {}} disabled />
        <StatusMessage message="Код больше не действует. Истёк срок или закончились попытки. Запросите новый код." tone="error" />
        {reset.message && <StatusMessage message={reset.message} tone="error" />}
        <ActionButton
          label="Получить новый код"
          disabled={!reset.canRequest}
          loading={reset.busy === 'request'}
          onPress={reset.requestCode}
        />
        <ActionButton label="Изменить email" variant="text" onPress={reset.changeEmail} />
      </View>
    </FormCard>
  );
}

function SuccessStep({ loading, onContinue }: { loading: boolean; onContinue: () => void }) {
  const styles = useStyles();
  const colors = usePalette();
  return (
    <FormCard>
      <View style={styles.stack}>
        <View style={styles.successIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <IconSymbol name="checkmark" color={colors.success} size={36} />
        </View>
        <Text accessibilityRole="header" style={styles.successTitle}>Пароль изменён</Text>
        <Text style={[styles.body, styles.centerText]}>На других устройствах используйте новый пароль при следующем входе.</Text>
        <ActionButton label="Продолжить" onPress={onContinue} loading={loading} />
      </View>
    </FormCard>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    header: {
      backgroundColor: c.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.separator,
      paddingHorizontal: space.sm,
      flexDirection: 'row',
      alignItems: 'center',
    },
    back: { flexShrink: 0 },
    headerTitle: {
      color: c.text,
      fontSize: typeSize.navigationTitle,
      fontWeight: '700',
      flex: 1,
      textAlign: 'center',
      marginRight: 72,
    },
    content: { flexGrow: 1, alignItems: 'center', padding: space.xl, gap: space.lg },
    center: { justifyContent: 'center' },
    body: { color: c.text, fontSize: typeSize.body, lineHeight: space.xxl },
    intro: { color: c.text, fontSize: typeSize.body, lineHeight: space.xxl, marginBottom: space.xxl },
    caption: { color: c.textSecondary, fontSize: typeSize.label, lineHeight: space.xl },
    stack: { gap: space.md },
    centerText: { textAlign: 'center' },
    emphasis: { fontWeight: '700' },
    help: { marginTop: space.xs },
    rules: { gap: space.xxs },
    met: { color: c.success, fontSize: typeSize.label, lineHeight: space.xl },
    successIcon: {
      alignSelf: 'center', width: 72, height: 72, borderRadius: 36,
      alignItems: 'center', justifyContent: 'center', backgroundColor: c.fill, marginBottom: space.sm,
    },
    successTitle: { textAlign: 'center', color: c.text, fontSize: typeSize.title, fontWeight: '700' },
  }),
);
