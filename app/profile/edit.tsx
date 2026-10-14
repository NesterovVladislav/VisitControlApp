import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CheckboxRow from '../../components/checkbox-row';
import FormField from '../../components/form-field';
import SegmentedControl from '../../components/segmented-control';
import { useAppDispatch, useAppSelector } from '../../store';
import { clearSaveFieldError, resetProfileSave, saveProfileStart } from '../../store/reducers/profile';
import { formatDate, formatPhone } from '../../utils/input-masks';
import {
  ProfileEditErrors,
  ProfileEditField,
  ProfileEditForm,
  formFromUser,
  isProfileChanged,
  toProfileUpdate,
  validateProfileField,
  validateProfileForm,
} from '../../utils/profile-edit';
import { makeStyles, usePalette } from '../../hooks/use-palette';

/**
 * Непосредственное изменение своих личных данных для всех ролей. Email остаётся логином.
 */
export default function ProfileEditScreen() {
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { saveStatus, saveFieldErrors, saveError } = useAppSelector((state) => state.profile);

  const initial = useMemo(() => (user ? formFromUser(user) : null), [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState<ProfileEditForm | null>(initial);
  const [clientErrors, setClientErrors] = useState<ProfileEditErrors>({});
  const firstNameRef = useRef<TextInput>(null);
  const patronymicRef = useRef<TextInput>(null);
  const birthDateRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const saving = saveStatus === 'saving';
  const changed = form !== null && initial !== null && isProfileChanged(form, initial);

  useEffect(() => {
    dispatch(resetProfileSave());
    return () => {
      dispatch(resetProfileSave());
    };
  }, [dispatch]);

  useEffect(() => {
    if (saveStatus === 'saved') {
      router.back();
    }
  }, [saveStatus, router]);

  usePreventRemove(changed && saveStatus !== 'saved', ({ data }) => {
    Alert.alert('Отменить изменения?', undefined, [
      { text: 'Продолжить редактирование', style: 'cancel' },
      { text: 'Отменить', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  if (!form || !user) {
    return null;
  }

  function errorFor(field: ProfileEditField): string | undefined {
    return clientErrors[field] ?? saveFieldErrors[field];
  }

  function update(patch: Partial<ProfileEditForm>, field: ProfileEditField) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setClientErrors((prev) => ({ ...prev, [field]: undefined }));
    if (saveFieldErrors[field]) {
      dispatch(clearSaveFieldError(field));
    }
  }

  function validateOnBlur(field: ProfileEditField) {
    if (form) {
      setClientErrors((prev) => ({ ...prev, [field]: validateProfileField(field, form) }));
    }
  }

  function save() {
    if (!form || saving || !changed) {
      return;
    }
    Keyboard.dismiss();
    const errors = validateProfileForm(form);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    dispatch(saveProfileStart(toProfileUpdate(form)));
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      // На Android с edgeToEdgeEnabled система не сжимает окно под клавиатуру, поэтому padding нужен и там.
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <FormField
          label="Фамилия"
          value={form.surname}
          onChangeText={(value) => update({ surname: value }, 'surname')}
          onBlur={() => validateOnBlur('surname')}
          error={errorFor('surname')}
          autoCapitalize="words"
          autoComplete="name-family"
          textContentType="familyName"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => firstNameRef.current?.focus()}
          editable={!saving}
        />
        <FormField
          ref={firstNameRef}
          label="Имя"
          value={form.firstName}
          onChangeText={(value) => update({ firstName: value }, 'firstName')}
          onBlur={() => validateOnBlur('firstName')}
          error={errorFor('firstName')}
          autoCapitalize="words"
          autoComplete="name-given"
          textContentType="givenName"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => (form.noPatronymic ? birthDateRef : patronymicRef).current?.focus()}
          editable={!saving}
        />
        <FormField
          ref={patronymicRef}
          label="Отчество"
          value={form.noPatronymic ? '' : form.patronymic}
          onChangeText={(value) => update({ patronymic: value }, 'patronymic')}
          onBlur={() => validateOnBlur('patronymic')}
          error={errorFor('patronymic')}
          autoCapitalize="words"
          autoComplete="name-middle"
          textContentType="middleName"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => birthDateRef.current?.focus()}
          editable={!saving && !form.noPatronymic}
        />
        <View style={styles.checkbox}>
          <CheckboxRow
            checked={form.noPatronymic}
            accessibilityLabel="Нет отчества"
            onChange={(checked) => update({ noPatronymic: checked }, 'patronymic')}
            disabled={saving}
          >
            <Text style={styles.checkboxText}>Нет отчества</Text>
          </CheckboxRow>
        </View>
        <FormField
          ref={birthDateRef}
          label="Дата рождения"
          value={form.birthDate}
          onChangeText={(value) => update({ birthDate: formatDate(value) }, 'birthDate')}
          onBlur={() => validateOnBlur('birthDate')}
          error={errorFor('birthDate')}
          placeholder="ДД.ММ.ГГГГ"
          keyboardType="number-pad"
          maxLength={10}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => phoneRef.current?.focus()}
          editable={!saving}
        />
        <SegmentedControl
          label="Пол"
          options={[{ value: 'FEMALE' as const, label: 'Женский' }, { value: 'MALE' as const, label: 'Мужской' }]}
          value={form.gender}
          onChange={(gender) => update({ gender }, 'gender')}
          error={errorFor('gender')}
          disabled={saving}
        />
        <FormField
          ref={phoneRef}
          label="Телефон"
          value={form.phone}
          onChangeText={(value) => update({ phone: formatPhone(value) }, 'phone')}
          onBlur={() => validateOnBlur('phone')}
          error={errorFor('phone')}
          placeholder="+7 (___) ___-__-__"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={18}
          returnKeyType="done"
          onSubmitEditing={save}
          editable={!saving}
        />
        <FormField
          label="Email"
          value={user.email}
          editable={false}
          hint="Email — логин для входа, здесь он не меняется"
        />

        {saveError ? (
          <View style={styles.banner} accessibilityLiveRegion="polite">
            <Text style={styles.bannerText}>{saveError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, (!changed || saving) && styles.buttonDisabled]}
          onPress={save}
          disabled={!changed || saving}
          accessibilityRole="button"
          accessibilityLabel="Сохранить"
          accessibilityState={{ disabled: !changed || saving, busy: saving }}
        >
          {saving ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>Сохранить</Text>}
        </TouchableOpacity>
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
      padding: 20,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    checkbox: {
      marginTop: -8,
      marginBottom: 16,
    },
    checkboxText: {
      fontSize: 15,
      color: c.text,
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
  })
);
