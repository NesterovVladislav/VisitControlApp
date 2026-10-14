import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FormField from '../../../components/form-field';
import PhotoEditor from '../../../components/photo-editor';
import { useAppDispatch, useAppSelector } from '../../../store';
import {
  cancelChildChangeStart,
  changeChildStart,
  loadOwnChildren,
  resetChildChange,
} from '../../../store/reducers/child-requests';
import { isAdminRole } from '../../../store/types/auth';
import { ChildErrors, ChildField, ChildForm } from '../../../store/types/registration';
import { changeDiff } from '../../../utils/child-requests';
import { formatDate, parseDate } from '../../../utils/input-masks';
import { formatBirthDate, genderLabel } from '../../../utils/profile-format';
import { validateChildField } from '../../../utils/registration-validation';
import { makeStyles, usePalette } from '../../../hooks/use-palette';

type Field = Exclude<ChildField, 'gender'>;
const FIELDS: Field[] = ['surname', 'firstName', 'patronymic', 'birthDate'];

/**
 * Данные ребёнка в профиле: ФИО и дата рождения. Администратор и директор меняют их сразу, родитель отправляет
 * изменение на подтверждение администратору сада. Пол не меняется, как и у взрослых.
 */
export default function ChildProfileScreen() {
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const dispatch = useAppDispatch();
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useAppSelector((state) => state.auth.user?.role);
  const { ownChildren, changeSubmitting, changeResult, changeError, decidingChangeIds } = useAppSelector(
    (state) => state.childRequests
  );
  const child = ownChildren?.find((item) => item.id === id) ?? null;
  const immediate = isAdminRole(role);
  const [form, setForm] = useState<ChildForm | null>(null);
  const [errors, setErrors] = useState<ChildErrors>({});

  useFocusEffect(
    useCallback(() => {
      dispatch(loadOwnChildren());
    }, [dispatch])
  );

  useEffect(() => {
    dispatch(resetChildChange());
    return () => {
      dispatch(resetChildChange());
    };
  }, [dispatch]);

  // Форма заполняется один раз, когда данные ребёнка загрузились: дальше её меняет только пользователь
  const childId = child?.id ?? null;
  useEffect(() => {
    if (child && !form) {
      setForm({
        key: child.id,
        surname: child.surname,
        firstName: child.firstName,
        patronymic: child.patronymic ?? '',
        birthDate: formatBirthDate(child.birthDate) ?? '',
        gender: child.gender,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  useEffect(() => {
    if (changeResult) {
      const applied = changeResult === 'APPROVED';
      Alert.alert(
        applied ? 'Данные изменены' : 'Изменение отправлено',
        applied ? undefined : 'Администратор сада проверит его. До подтверждения данные ребёнка остаются прежними.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [changeResult, router]);

  // Ошибку отзыва изменения показывает раздел «Мои дети» в профиле: он остаётся открытым под этим экраном
  useEffect(() => {
    if (changeError) {
      Alert.alert('Не получилось', changeError, [{ text: 'OK', onPress: () => dispatch(resetChildChange()) }]);
    }
  }, [changeError, dispatch]);

  if (!child || !form) {
    return (
      <View style={styles.center}>
        {ownChildren === null ? (
          <ActivityIndicator size="large" color={c.primary} />
        ) : (
          <Text style={styles.message}>Ребёнок не найден</Text>
        )}
      </View>
    );
  }

  const pending = child.change?.status === 'PENDING' ? child.change : null;
  const rejected = child.change?.status === 'REJECTED' ? child.change : null;
  const cancelling = pending ? decidingChangeIds.includes(pending.id) : false;
  const locked = !child.canEdit || pending !== null || changeSubmitting;

  function setField(field: Field, value: string) {
    setForm((previous) => (previous ? { ...previous, [field]: value } : previous));
    setErrors((previous) => {
      const cleared = { ...previous };
      delete cleared[field];
      return cleared;
    });
  }

  function validateOnBlur(field: Field) {
    if (!form || !form[field]) {
      return;
    }
    setErrors((previous) => ({ ...previous, [field]: validateChildField(field, form) }));
  }

  function submit() {
    if (!form || !child || locked) {
      return;
    }
    Keyboard.dismiss();
    const found: ChildErrors = {};
    for (const field of FIELDS) {
      const fieldError = validateChildField(field, form);
      if (fieldError) {
        found[field] = fieldError;
      }
    }
    setErrors(found);
    const birthDate = parseDate(form.birthDate);
    if (Object.keys(found).length > 0 || !birthDate) {
      return;
    }
    const patronymic = form.patronymic.trim();
    const unchanged =
      form.surname.trim() === child.surname &&
      form.firstName.trim() === child.firstName &&
      patronymic === (child.patronymic ?? '') &&
      birthDate.iso === child.birthDate;
    if (unchanged) {
      Alert.alert('Нечего менять', 'Данные ребёнка не изменились.');
      return;
    }
    dispatch(
      changeChildStart({
        childId: child.id,
        data: {
          surname: form.surname.trim(),
          first_name: form.firstName.trim(),
          ...(patronymic ? { patronymic } : {}),
          birth_date: birthDate.iso,
        },
      })
    );
  }

  function confirmCancel() {
    if (!pending) {
      return;
    }
    Alert.alert('Отозвать изменение?', 'Сад его ещё не рассмотрел. Данные ребёнка останутся прежними.', [
      { text: 'Нет', style: 'cancel' },
      { text: 'Отозвать', style: 'destructive', onPress: () => dispatch(cancelChildChangeStart(pending.id)) },
    ]);
  }

  let hint: string;
  if (!child.canEdit) {
    hint = 'Менять данные ребёнка может его родитель или администратор сада.';
  } else if (immediate) {
    hint = 'Изменение применится сразу.';
  } else {
    hint = 'Изменение проверит администратор сада. До подтверждения данные ребёнка остаются прежними.';
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      // На Android с edgeToEdgeEnabled система не сжимает окно под клавиатуру, поэтому padding нужен и там.
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Фотографию ребёнка меняет только родитель; родственник и знакомый её видят */}
        <PhotoEditor
          userId={child.id}
          childId={child.id}
          firstName={child.firstName}
          surname={child.surname}
          photoUrl={child.photoUrl}
          canEdit={child.canEditPhoto === true}
        />
        {pending ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Изменение ждёт подтверждения сада</Text>
            {changeDiff(pending).map((line) => (
              <Text key={line} style={styles.bannerText}>
                {line}
              </Text>
            ))}
            {cancelling ? (
              <ActivityIndicator style={styles.bannerAction} color={c.textTertiary} />
            ) : (
              <TouchableOpacity style={styles.bannerAction} onPress={confirmCancel} accessibilityRole="button">
                <Text style={styles.cancel}>Отозвать изменение</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
        {rejected ? (
          <View style={[styles.banner, styles.bannerRejected]}>
            <Text style={styles.bannerTitle}>Сад отклонил изменение</Text>
            {changeDiff(rejected).map((line) => (
              <Text key={line} style={styles.bannerText}>
                {line}
              </Text>
            ))}
            {rejected.reason ? <Text style={styles.bannerText}>Причина: {rejected.reason}</Text> : null}
          </View>
        ) : null}
        <Text style={styles.hint}>{hint}</Text>
        <FormField
          label="Фамилия"
          value={form.surname}
          onChangeText={(value) => setField('surname', value)}
          onBlur={() => validateOnBlur('surname')}
          error={errors.surname}
          editable={!locked}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <FormField
          label="Имя"
          value={form.firstName}
          onChangeText={(value) => setField('firstName', value)}
          onBlur={() => validateOnBlur('firstName')}
          error={errors.firstName}
          editable={!locked}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <FormField
          label="Отчество"
          hint="Если есть"
          value={form.patronymic}
          onChangeText={(value) => setField('patronymic', value)}
          onBlur={() => validateOnBlur('patronymic')}
          error={errors.patronymic}
          editable={!locked}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <FormField
          label="Дата рождения"
          placeholder="ДД.ММ.ГГГГ"
          value={form.birthDate}
          onChangeText={(value) => setField('birthDate', formatDate(value))}
          onBlur={() => validateOnBlur('birthDate')}
          error={errors.birthDate}
          editable={!locked}
          keyboardType="number-pad"
          maxLength={10}
        />
        {genderLabel(child.gender) ? (
          <Text style={styles.gender}>Пол: {genderLabel(child.gender)} · изменить нельзя</Text>
        ) : null}
        {child.canEdit && !pending ? (
          <TouchableOpacity
            style={[styles.button, changeSubmitting && styles.buttonDisabled]}
            onPress={submit}
            disabled={changeSubmitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: changeSubmitting, busy: changeSubmitting }}
          >
            {changeSubmitting ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{immediate ? 'Сохранить' : 'Отправить на подтверждение'}</Text>
            )}
          </TouchableOpacity>
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
      padding: 20,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
      padding: 20,
    },
    message: {
      fontSize: 16,
      color: c.textSecondary,
    },
    hint: {
      marginBottom: 16,
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
    },
    banner: {
      marginBottom: 16,
      padding: 14,
      borderRadius: 10,
      backgroundColor: c.primarySoft,
    },
    bannerRejected: {
      backgroundColor: c.dangerSoft,
    },
    bannerTitle: {
      marginBottom: 4,
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },
    bannerText: {
      fontSize: 14,
      lineHeight: 20,
      color: c.text,
    },
    bannerAction: {
      marginTop: 10,
      alignSelf: 'flex-start',
    },
    cancel: {
      fontSize: 15,
      fontWeight: '500',
      color: c.danger,
    },
    gender: {
      marginBottom: 16,
      fontSize: 14,
      color: c.textTertiary,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: 8,
      minHeight: 48,
      marginTop: 8,
      alignItems: 'center',
      justifyContent: 'center',
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
