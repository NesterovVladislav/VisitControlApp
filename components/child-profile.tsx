import { useProfileLayout } from './profile-layout';
import { useNavigation, usePreventRemove, useFocusEffect, useIsFocused } from '@react-navigation/native';
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
import FormField from './form-field';
import { ActionButton } from './ui';
import { ProfileFields, ProfileIdentity } from './profile-person';
import PhotoEditor from './photo-editor';
import { useAppDispatch, useAppSelector } from '../store';
import {
  cancelChildChangeStart,
  changeChildStart,
  loadOwnChildren,
  resetChildChange,
} from '../store/reducers/child-requests';
import { loadOwnPhotoRequests } from '../store/reducers/photos';
import { isAdminRole } from '../store/types/auth';
import { ChildErrors, ChildField, ChildForm } from '../store/types/registration';
import { changeDiff } from '../utils/child-requests';
import { formatDate, parseDate } from '../utils/input-masks';
import { formatBirthDate, genderLabel } from '../utils/profile-format';
import { validateChildField } from '../utils/registration-validation';
import { makeStyles, usePalette } from '../hooks/use-palette';

type Field = Exclude<ChildField, 'gender'>;
const FIELDS: Field[] = ['surname', 'firstName', 'patronymic', 'birthDate'];

/**
 * Данные ребёнка в профиле: ФИО и дата рождения. Администратор и директор меняют их сразу, родитель отправляет
 * изменение на подтверждение администратору сада. Пол не меняется, как и у взрослых.
 */
export default function ChildProfile({ editing }: { editing: boolean }) {
  const layout = useProfileLayout();
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const navigation = useNavigation();
  const focused = useIsFocused();
  const headerHeight = useHeaderHeight();
  const dispatch = useAppDispatch();
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useAppSelector((state) => state.auth.user?.role);
  const { ownChildren, changeSubmitting, changeResult, changeError, decidingChangeIds } = useAppSelector(
    (state) => state.childRequests
  );
  const child = ownChildren?.find((item) => item.id === id) ?? null;
  const photoRequest = useAppSelector(state => state.photos.own.find(item => item.userId === id));
  const immediate = isAdminRole(role);
  const [form, setForm] = useState<ChildForm | null>(null);
  const [errors, setErrors] = useState<ChildErrors>({});

  useFocusEffect(
    useCallback(() => {
      dispatch(loadOwnChildren());
      if (!editing) dispatch(loadOwnPhotoRequests());
    }, [dispatch, editing])
  );

  useEffect(() => {
    if (!editing) return;
    dispatch(resetChildChange());
    return () => {
      dispatch(resetChildChange());
    };
  }, [dispatch, editing]);

  // Форма заполняется один раз, когда данные ребёнка загрузились: дальше её меняет только пользователь
  const childId = child?.id ?? null;
  useEffect(() => {
    if (editing && child && !form) {
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
  }, [childId, editing]);

  useEffect(() => {
    if (editing && changeResult) {
      const applied = changeResult === 'APPROVED';
      Alert.alert(
        applied ? 'Данные изменены' : 'Изменение отправлено',
        applied ? undefined : 'Администратор сада проверит его. До подтверждения данные ребёнка остаются прежними.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [changeResult, router, editing]);

  // Ошибку отзыва изменения показывает раздел «Мои дети» в профиле: он остаётся открытым под этим экраном
  useEffect(() => {
    if (focused && changeError && (editing || child?.change?.status === 'PENDING')) {
      Alert.alert('Не получилось', changeError, [{ text: 'OK', onPress: () => dispatch(resetChildChange()) }]);
    }
  }, [changeError, dispatch, focused, editing, child?.change?.status]);

  const changed = Boolean(child && form && (form.firstName.trim() !== child.firstName ||
    form.surname.trim() !== child.surname || form.patronymic.trim() !== (child.patronymic ?? '') ||
    form.birthDate !== (formatBirthDate(child.birthDate) ?? '')));
  usePreventRemove(editing && changed && !changeResult, ({ data }) => {
    Alert.alert('Отменить изменения?', undefined, [
      { text: 'Продолжить редактирование', style: 'cancel' },
      { text: 'Отменить', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  if (!child || (editing && !form)) {
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
    if (!form || !child || locked || !changed) {
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
      <ScrollView contentContainerStyle={layout.content} keyboardShouldPersistTaps="handled">
        {/* Фотографию ребёнка меняет только родитель; родственник и знакомый её видят */}
        <View style={layout.block}>
          {editing ? <PhotoEditor
            userId={child.id}
            childId={child.id}
            firstName={child.firstName}
            surname={child.surname}
            photoUrl={child.photoUrl}
            canEdit={child.canEditPhoto === true}
          /> : <ProfileIdentity {...child} photoUrl={photoRequest?.status === 'PENDING' ? photoRequest.imageUrl ?? child.photoUrl : child.photoUrl} />}
        </View>
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
        {editing && form && child.canEdit && !pending ? (
          <View style={layout.block}>
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
              <FormField label="Пол" value={genderLabel(child.gender) ?? ''} editable={false} />
            ) : null}
          </View>
        ) : <ProfileFields fields={[
          ['Фамилия', child.surname], ['Имя', child.firstName], ['Отчество', child.patronymic],
          ['Дата рождения', formatBirthDate(child.birthDate)], ['Пол', genderLabel(child.gender)],
        ]} />}
        {editing && child.canEdit && !pending && <Text style={styles.hint}>{hint}</Text>}
        {!editing && !child.canEdit && <Text style={styles.hint}>{hint}</Text>}
        {!editing && ((child.canEdit && !pending) || child.canEditPhoto || photoRequest?.status === 'PENDING') &&
          <ActionButton label="Редактировать" onPress={() => router.push({ pathname: '/profile/child/edit/[id]', params: { id: child.id } })} />}
        {editing && child.canEdit && !pending && <ActionButton label={immediate ? 'Сохранить' : 'Отправить на подтверждение'}
          onPress={submit} disabled={!changed} loading={changeSubmitting} />}
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
      paddingHorizontal: 4,
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
    },
    banner: {
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
  })
);
