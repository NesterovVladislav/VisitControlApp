import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import ChildFormCard from '../components/child-form-card';
import FormField from '../components/form-field';
import OrganizationLogo from '../components/organization-logo';
import OrganizationPicker from '../components/organization-picker';
import RegistrationSent from '../components/registration-sent';
import SegmentedControl from '../components/segmented-control';
import { useAppDispatch, useAppSelector } from '../store';
import {
  clearFieldError,
  clearFormError,
  loadOrganizationsStart,
  loadPolicyStart,
  registerStart,
  resetRegistration,
  selectOrganization,
} from '../store/reducers/registration';
import { REGISTRATION_ERRORS } from '../store/sagas/registration';
import {
  ChildErrors,
  ChildField,
  ChildForm,
  Gender,
  RegistrationField,
  RegistrationFieldErrors,
  RegistrationForm,
  RegistrationRole,
} from '../store/types/registration';
import { formatDate, formatPhone } from '../utils/input-masks';
import {
  FIELD_ORDER,
  MAX_CHILDREN,
  toRegistrationRequest,
  validateChildField,
  validateChildren,
  validateField,
  validateForm,
} from '../utils/registration-validation';
import { makeStyles, usePalette } from '../hooks/use-palette';

const EMPTY_FORM: RegistrationForm = {
  role: 'PARENT',
  surname: '',
  firstName: '',
  patronymic: '',
  noPatronymic: false,
  birthDate: '',
  gender: null,
  email: '',
  phone: '',
  consent: false,
  children: [],
};

const ROLE_OPTIONS: { value: RegistrationRole; label: string }[] = [
  { value: 'PARENT', label: 'Родитель' },
  { value: 'EMPLOYEE', label: 'Сотрудник' },
];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'FEMALE', label: 'Женский' },
  { value: 'MALE', label: 'Мужской' },
];

function isDirty(form: RegistrationForm): boolean {
  if (form.children.length > 0) {
    return true;
  }
  return (Object.keys(EMPTY_FORM) as (keyof RegistrationForm)[]).some(
    (key) => key !== 'children' && form[key] !== EMPTY_FORM[key]
  );
}

let nextChildKey = 0;

/** Новый ребёнок: фамилия — как у родителя, обычно она совпадает */
function newChild(surname: string): ChildForm {
  nextChildKey += 1;
  return { key: `child-${nextChildKey}`, surname, firstName: '', patronymic: '', birthDate: '', gender: null };
}

export default function RegisterScreen() {
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const dispatch = useAppDispatch();
  const {
    organizations,
    organizationsStatus,
    organization,
    policy,
    policyStatus,
    status,
    fieldErrors,
    formError,
    consentResetCount,
    sentToEmail,
  } = useAppSelector((state) => state.registration);

  const [form, setForm] = useState<RegistrationForm>(EMPTY_FORM);
  const [clientErrors, setClientErrors] = useState<RegistrationFieldErrors>({});
  const [childErrors, setChildErrors] = useState<Record<string, ChildErrors>>({});
  const childrenY = useRef(0);
  const childY = useRef<Record<string, number>>({});
  const isParent = form.role === 'PARENT';

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
  // Сменить сад можно, только если есть из чего выбирать
  const canChangeOrganization = organizations.filter((item) => item.registrationAvailable).length > 1;

  // Каждое открытие экрана — с чистого листа и с актуальным списком садов. Политику загрузим после выбора сада.
  useEffect(() => {
    dispatch(resetRegistration());
    dispatch(loadOrganizationsStart());
  }, [dispatch]);

  // Политика обновилась или выбран другой сад: согласие нужно дать заново.
  useEffect(() => {
    if (consentResetCount > 0) {
      setForm((prev) => ({ ...prev, consent: false }));
    }
  }, [consentResetCount]);

  // Сервер вернул ошибки полей — показываем первое.
  useEffect(() => {
    scrollToFirstError(fieldErrors);
  }, [fieldErrors]);

  // Итог показываем на месте формы, без перехода: заголовок с «Назад» на нём не нужен.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: status !== 'sent' });
  }, [navigation, status]);

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

  function addChild() {
    setForm((prev) => ({ ...prev, children: [...prev.children, newChild(prev.surname.trim())] }));
  }

  function removeChild(key: string) {
    setForm((prev) => ({ ...prev, children: prev.children.filter((child) => child.key !== key) }));
    setChildErrors((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function updateChild(child: ChildForm, field: ChildField) {
    setForm((prev) => ({
      ...prev,
      children: prev.children.map((item) => (item.key === child.key ? child : item)),
    }));
    // Как у полей родителя: видимая ошибка исчезает сразу после исправления
    if (childErrors[child.key]?.[field]) {
      setChildErrors((prev) => ({
        ...prev,
        [child.key]: { ...prev[child.key], [field]: validateChildField(field, child) },
      }));
    }
    if (formError) {
      dispatch(clearFormError());
    }
  }

  function validateChildOnBlur(child: ChildForm, field: ChildField) {
    setChildErrors((prev) => ({
      ...prev,
      [child.key]: { ...prev[child.key], [field]: validateChildField(field, child) },
    }));
  }

  function handleSubmit() {
    if (isSubmitting || !policy || !organization) {
      return;
    }
    Keyboard.dismiss();
    const errors = validateForm(form);
    const childrenErrors = validateChildren(form);
    setClientErrors(errors);
    setChildErrors(childrenErrors);
    if (Object.keys(errors).length > 0) {
      scrollToFirstError(errors);
      return;
    }
    const firstChildWithError = form.children.find((child) => childrenErrors[child.key]);
    if (firstChildWithError) {
      const y = childrenY.current + (childY.current[firstChildWithError.key] ?? 0);
      scrollRef.current?.scrollTo({ y: Math.max(cardY.current + y - 16, 0), animated: true });
      return;
    }
    dispatch(registerStart(toRegistrationRequest(form, organization.id, policy.version)));
  }

  function openPolicy() {
    if (policy) {
      WebBrowser.openBrowserAsync(policy.url);
    }
  }

  const goToLogin = () => router.back();

  // Данные детей родитель передаёт как их законный представитель
  const consentText =
    isParent && form.children.length > 0
      ? 'Даю согласие на обработку моих персональных данных и персональных данных моих детей'
      : 'Даю согласие на обработку персональных данных';

  if (status === 'sent') {
    // Состояние сбросится при следующем открытии экрана; сбрасывать здесь нельзя —
    // форма снова станет «несохранённой» и уход с экрана спросит подтверждение.
    return <RegistrationSent email={sentToEmail} onDone={goToLogin} />;
  }

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
          {!organization ? (
            <OrganizationPicker
              organizations={organizations}
              status={organizationsStatus}
              error={formError}
              onSelect={(item) => dispatch(selectOrganization(item))}
              onRetry={() => dispatch(loadOrganizationsStart())}
            />
          ) : (
            <>
              <View style={styles.organization}>
                <OrganizationLogo name={organization.name} logoUrl={organization.logoUrl} size={40} />
                <Text style={styles.organizationName} numberOfLines={2}>
                  {organization.name}
                </Text>
                {canChangeOrganization ? (
                  <TouchableOpacity
                    onPress={() => dispatch(selectOrganization(null))}
                    disabled={isSubmitting}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Выбрать другой сад"
                  >
                    <Text style={styles.link}>Изменить</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <SegmentedControl
                label="Вы регистрируетесь как"
                options={ROLE_OPTIONS}
                value={form.role}
                onChange={(value) => update('role', value)}
                disabled={isSubmitting}
              />

              <Text style={styles.subtitle}>
                {isParent
                  ? 'Администратор сада проверит данные, добавит ваших детей и пришлёт пароль на email'
                  : 'Администратор сада проверит данные и пришлёт пароль на email'}
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

              {isParent ? (
                <View onLayout={(event) => (childrenY.current = event.nativeEvent.layout.y)}>
                  <Text style={styles.section}>ДЕТИ</Text>
                  <Text style={styles.childrenHint}>
                    Укажите детей, которые ходят в этот сад. Если ребёнка уже записал второй родитель,
                    администратор свяжет вас с ним
                  </Text>
                  {form.children.map((child, index) => (
                    <View
                      key={child.key}
                      onLayout={(event) => (childY.current[child.key] = event.nativeEvent.layout.y)}
                    >
                      <ChildFormCard
                        index={index}
                        child={child}
                        errors={childErrors[child.key] ?? {}}
                        disabled={isSubmitting}
                        onChange={updateChild}
                        onBlur={(field) => validateChildOnBlur(child, field)}
                        onRemove={() => removeChild(child.key)}
                      />
                    </View>
                  ))}
                  {form.children.length < MAX_CHILDREN ? (
                    <TouchableOpacity
                      style={styles.addChild}
                      onPress={addChild}
                      disabled={isSubmitting}
                      accessibilityRole="button"
                    >
                      <Text style={styles.addChildText}>+ Добавить ребёнка</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

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
                    <ActivityIndicator size="small" color={c.textTertiary} />
                    <Text style={styles.policyStatus}>  Загружаем политику обработки данных…</Text>
                  </View>
                ) : (
                  <CheckboxRow
                    checked={form.consent}
                    onChange={(checked) => update('consent', checked)}
                    error={errorOf('consent')}
                    disabled={isSubmitting}
                    accessibilityLabel={consentText}
                  >
                    {consentText} на условиях{' '}
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
                  <ActivityIndicator color={c.onPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Отправить заявку</Text>
                )}
              </TouchableOpacity>
            </>
          )}

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

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: c.background,
    },
    container: {
      padding: 20,
      alignItems: 'center',
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 24,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    organization: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    organizationName: {
      flex: 1,
      marginHorizontal: 12,
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      marginBottom: 24,
      lineHeight: 21,
    },
    section: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: c.textTertiary,
      marginBottom: 12,
      marginTop: 4,
    },
    link: {
      color: c.primary,
      fontWeight: '500',
      marginTop: 4,
    },
    childrenHint: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    addChild: {
      borderWidth: 1,
      borderColor: c.primary,
      borderStyle: 'dashed',
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      marginBottom: 20,
    },
    addChildText: {
      color: c.primary,
      fontSize: 16,
      fontWeight: '500',
    },
    policyLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    policyStatus: {
      fontSize: 14,
      color: c.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    banner: {
      backgroundColor: c.dangerSoft,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    bannerText: {
      color: c.danger,
      fontSize: 14,
      lineHeight: 20,
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
    footer: {
      marginTop: 20,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 14,
      color: c.textSecondary,
    },
  })
);
