import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CheckboxRow from '../components/checkbox-row';
import FormField from '../components/form-field';
import SegmentedControl from '../components/segmented-control';
import { useAppDispatch, useAppSelector } from '../store';
import {
  clearFieldError,
  clearFormError,
  loadPolicyStart,
  registerStart,
  resetRegistration,
} from '../store/reducers/registration';
import { REGISTRATION_ERRORS } from '../store/sagas/registration';
import {
  Gender,
  RegistrationField,
  RegistrationFieldErrors,
  RegistrationForm,
} from '../store/types/registration';
import { formatDate, formatPhone } from '../utils/input-masks';
import {
  FIELD_ORDER,
  toRegistrationRequest,
  validateField,
  validateForm,
} from '../utils/registration-validation';

const EMPTY_FORM: RegistrationForm = {
  surname: '',
  firstName: '',
  patronymic: '',
  noPatronymic: false,
  birthDate: '',
  gender: null,
  email: '',
  phone: '',
  consent: false,
};

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'FEMALE', label: 'Женский' },
  { value: 'MALE', label: 'Мужской' },
];

function isDirty(form: RegistrationForm): boolean {
  return (Object.keys(EMPTY_FORM) as (keyof RegistrationForm)[]).some(
    (key) => form[key] !== EMPTY_FORM[key]
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const dispatch = useAppDispatch();
  const { policy, policyStatus, status, fieldErrors, formError, consentResetCount, sentToEmail } =
    useAppSelector((state) => state.registration);

  const [form, setForm] = useState<RegistrationForm>(EMPTY_FORM);
  const [clientErrors, setClientErrors] = useState<RegistrationFieldErrors>({});

  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef(0);
  const fieldY = useRef<Partial<Record<RegistrationField, number>>>({});
  const focusedField = useRef<RegistrationField | null>(null);
  const firstNameRef = useRef<TextInput>(null);
  const patronymicRef = useRef<TextInput>(null);
  const birthDateRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const isSubmitting = status === 'submitting';

  // Каждое открытие экрана — с чистого листа и с актуальной версией политики.
  useEffect(() => {
    dispatch(resetRegistration());
    dispatch(loadPolicyStart());
  }, [dispatch]);

  // Политика обновилась, пока пользователь заполнял форму: согласие нужно дать заново.
  useEffect(() => {
    if (consentResetCount > 0) {
      setForm((prev) => ({ ...prev, consent: false }));
    }
  }, [consentResetCount]);

  // Сервер вернул ошибки полей — показываем первое.
  useEffect(() => {
    scrollToFirstError(fieldErrors);
  }, [fieldErrors]);

  useEffect(() => {
    if (status === 'sent') {
      router.replace({ pathname: '/registration-sent', params: { email: sentToEmail ?? '' } });
    }
  }, [status, sentToEmail, router]);

  usePreventRemove(isDirty(form) && status !== 'sent', ({ data }) => {
    Alert.alert('Выйти без сохранения?', 'Введённые данные пропадут.', [
      { text: 'Остаться', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  function scrollToField(field: RegistrationField) {
    const y = fieldY.current[field];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(cardY.current + y - 16, 0), animated: true });
    }
  }

  function scrollToFirstError(errors: RegistrationFieldErrors) {
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) {
      scrollToField(first);
    }
  }

  // Клавиатура уже открыта (переход по «Далее») — сразу показываем поле.
  // Если ещё нет, прокрутим в onLayout, когда экран сожмётся под клавиатуру.
  function handleFocus(field: RegistrationField) {
    focusedField.current = field;
    if (Keyboard.isVisible()) {
      scrollToField(field);
    }
  }

  function handleScrollLayout() {
    if (focusedField.current && Keyboard.isVisible()) {
      scrollToField(focusedField.current);
    }
  }

  function update<K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) {
    const next = { ...form, [key]: value };
    setForm(next);
    const field = (key === 'noPatronymic' ? 'patronymic' : key) as RegistrationField;
    // Ошибку, которую пользователь уже видит, пересчитываем на лету, чтобы она исчезла сразу после исправления.
    if (clientErrors[field]) {
      setClientErrors((prev) => ({ ...prev, [field]: validateField(field, next) }));
    }
    if (fieldErrors[field]) {
      dispatch(clearFieldError(field));
    }
    if (formError) {
      dispatch(clearFormError());
    }
  }

  function validateOnBlur(field: RegistrationField) {
    setClientErrors((prev) => ({ ...prev, [field]: validateField(field, form) }));
  }

  function errorOf(field: RegistrationField): string | undefined {
    return fieldErrors[field] ?? clientErrors[field];
  }

  function trackPosition(field: RegistrationField) {
    return (event: { nativeEvent: { layout: { y: number } } }) => {
      fieldY.current[field] = event.nativeEvent.layout.y;
    };
  }

  function handleSubmit() {
    if (isSubmitting || !policy) {
      return;
    }
    Keyboard.dismiss();
    const errors = validateForm(form);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstError(errors);
      return;
    }
    dispatch(registerStart(toRegistrationRequest(form, policy.version)));
  }

  function openPolicy() {
    if (policy) {
      WebBrowser.openBrowserAsync(policy.url);
    }
  }

  const goToLogin = () => router.back();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      // На Android с edgeToEdgeEnabled система не сжимает окно под клавиатуру, поэтому padding нужен и там.
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        onLayout={handleScrollLayout}
      >
        <View style={styles.card} onLayout={(event) => (cardY.current = event.nativeEvent.layout.y)}>
          <Text style={styles.subtitle}>
            Администратор сада проверит данные и пришлёт пароль на email
          </Text>

          <Text style={styles.section}>О ВАС</Text>

          <View onLayout={trackPosition('surname')}>
            <FormField
              label="Фамилия"
              placeholder="Иванова"
              value={form.surname}
              onChangeText={(value) => update('surname', value)}
              onFocus={() => handleFocus('surname')}
              onBlur={() => validateOnBlur('surname')}
              error={errorOf('surname')}
              editable={!isSubmitting}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="familyName"
              autoComplete="name-family"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => firstNameRef.current?.focus()}
            />
          </View>

          <View onLayout={trackPosition('firstName')}>
            <FormField
              ref={firstNameRef}
              label="Имя"
              placeholder="Мария"
              value={form.firstName}
              onChangeText={(value) => update('firstName', value)}
              onFocus={() => handleFocus('firstName')}
              onBlur={() => validateOnBlur('firstName')}
              error={errorOf('firstName')}
              editable={!isSubmitting}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="givenName"
              autoComplete="name-given"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() =>
                (form.noPatronymic ? birthDateRef : patronymicRef).current?.focus()
              }
            />
          </View>

          <View onLayout={trackPosition('patronymic')}>
            <FormField
              ref={patronymicRef}
              label="Отчество"
              placeholder={form.noPatronymic ? '' : 'Петровна'}
              value={form.noPatronymic ? '' : form.patronymic}
              onChangeText={(value) => update('patronymic', value)}
              onFocus={() => handleFocus('patronymic')}
              onBlur={() => validateOnBlur('patronymic')}
              error={errorOf('patronymic')}
              editable={!isSubmitting && !form.noPatronymic}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="middleName"
              autoComplete="name-middle"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => birthDateRef.current?.focus()}
            />
            <CheckboxRow
              checked={form.noPatronymic}
              onChange={(checked) => update('noPatronymic', checked)}
              disabled={isSubmitting}
            >
              Нет отчества
            </CheckboxRow>
          </View>

          <View onLayout={trackPosition('birthDate')}>
            <FormField
              ref={birthDateRef}
              label="Дата рождения"
              placeholder="ДД.ММ.ГГГГ"
              value={form.birthDate}
              onChangeText={(value) => update('birthDate', formatDate(value))}
              onFocus={() => handleFocus('birthDate')}
              onBlur={() => validateOnBlur('birthDate')}
              error={errorOf('birthDate')}
              editable={!isSubmitting}
              keyboardType="number-pad"
              maxLength={10}
              autoComplete="birthdate-full"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </View>

          <View onLayout={trackPosition('gender')}>
            <SegmentedControl
              label="Пол"
              options={GENDER_OPTIONS}
              value={form.gender}
              onChange={(value) => update('gender', value)}
              error={errorOf('gender')}
              disabled={isSubmitting}
            />
          </View>

          <Text style={styles.section}>КОНТАКТЫ</Text>

          <View onLayout={trackPosition('email')}>
            <FormField
              ref={emailRef}
              label="Email"
              placeholder="maria@mail.ru"
              hint="На этот адрес придёт пароль"
              value={form.email}
              onChangeText={(value) => update('email', value)}
              onFocus={() => handleFocus('email')}
              onBlur={() => validateOnBlur('email')}
              error={errorOf('email')}
              errorAction={
                fieldErrors.email === REGISTRATION_ERRORS.emailTaken ? (
                  <TouchableOpacity onPress={goToLogin} accessibilityRole="link">
                    <Text style={styles.link}>Войти</Text>
                  </TouchableOpacity>
                ) : undefined
              }
              editable={!isSubmitting}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          </View>

          <View onLayout={trackPosition('phone')}>
            <FormField
              ref={phoneRef}
              label="Телефон"
              placeholder="+7 (___) ___-__-__"
              value={form.phone}
              onChangeText={(value) => update('phone', formatPhone(value))}
              onFocus={() => handleFocus('phone')}
              onBlur={() => validateOnBlur('phone')}
              error={errorOf('phone')}
              editable={!isSubmitting}
              keyboardType="phone-pad"
              maxLength={18}
              textContentType="telephoneNumber"
              autoComplete="tel"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          <View onLayout={trackPosition('consent')}>
            {policyStatus === 'failed' ? (
              <Text style={styles.policyStatus}>
                Не удалось загрузить политику обработки персональных данных.{' '}
                <Text style={styles.link} onPress={() => dispatch(loadPolicyStart())}>
                  Повторить
                </Text>
              </Text>
            ) : !policy ? (
              <View style={styles.policyLoading}>
                <ActivityIndicator size="small" color="#999" />
                <Text style={styles.policyStatus}>  Загружаем политику обработки данных…</Text>
              </View>
            ) : (
              <CheckboxRow
                checked={form.consent}
                onChange={(checked) => update('consent', checked)}
                error={errorOf('consent')}
                disabled={isSubmitting}
                accessibilityLabel="Даю согласие на обработку персональных данных"
              >
                Даю согласие на обработку персональных данных на условиях{' '}
                <Text style={styles.link} onPress={openPolicy} accessibilityRole="link">
                  Политики
                </Text>
              </CheckboxRow>
            )}
          </View>

          {formError ? (
            <View style={styles.banner} accessibilityLiveRegion="polite">
              <Text style={styles.bannerText}>{formError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, (isSubmitting || !policy) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || !policy}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting || !policy, busy: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Отправить заявку</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.footer} onPress={goToLogin} disabled={isSubmitting}>
            <Text style={styles.footerText}>
              Уже есть аккаунт? <Text style={styles.link}>Войти</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    padding: 20,
    alignItems: 'center',
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
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
    lineHeight: 21,
  },
  section: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#888',
    marginBottom: 12,
    marginTop: 4,
  },
  link: {
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 4,
  },
  policyLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  policyStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  banner: {
    backgroundColor: '#FDECEA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  bannerText: {
    color: '#B71C1C',
    fontSize: 14,
    lineHeight: 20,
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
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
});
