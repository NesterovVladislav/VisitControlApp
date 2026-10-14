import { useHeaderHeight } from '@react-navigation/elements';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import ChildFormCard from '../../components/child-form-card';
import { useAppDispatch, useAppSelector } from '../../store';
import { resetChildSubmit, submitChildStart } from '../../store/reducers/child-requests';
import { isAdminRole } from '../../store/types/auth';
import { ChildErrors, ChildField, ChildForm } from '../../store/types/registration';
import { CHILD_FIELD_ORDER, toChildRequest, validateChildField } from '../../utils/registration-validation';
import { makeStyles, usePalette } from '../../hooks/use-palette';

const EMPTY_CHILD: ChildForm = { key: 'child', surname: '', firstName: '', patronymic: '', birthDate: '', gender: null };

/**
 * «Добавить ребёнка» из профиля. Администратор и директор добавляют ребёнка себе сразу, родитель и сотрудник
 * отправляют заявку — её подтверждает администратор сада, как детей из заявки на регистрацию.
 */
export default function AddChildScreen() {
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const dispatch = useAppDispatch();
  const role = useAppSelector((state) => state.auth.user?.role);
  const { submitting, submitResult, submitError } = useAppSelector((state) => state.childRequests);
  const [child, setChild] = useState<ChildForm>(EMPTY_CHILD);
  const [errors, setErrors] = useState<ChildErrors>({});
  const immediate = isAdminRole(role);

  useEffect(() => {
    dispatch(resetChildSubmit());
    return () => {
      dispatch(resetChildSubmit());
    };
  }, [dispatch]);

  useEffect(() => {
    if (submitResult) {
      const added = submitResult === 'ADDED';
      Alert.alert(
        added ? 'Ребёнок добавлен' : 'Заявка отправлена',
        added
          ? 'Он появился в списке «Мои дети». В группу ребёнка можно поместить во вкладке «Сад».'
          : 'Администратор сада проверит данные. После подтверждения ребёнок появится в списке «Мои дети».',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [submitResult, router]);

  useEffect(() => {
    if (submitError) {
      Alert.alert('Не получилось', submitError, [{ text: 'OK', onPress: () => dispatch(resetChildSubmit()) }]);
    }
  }, [submitError, dispatch]);

  function change(next: ChildForm, field: ChildField) {
    setChild(next);
    setErrors((previous) => {
      const cleared = { ...previous };
      delete cleared[field];
      return cleared;
    });
  }

  function validateOnBlur(field: ChildField) {
    // Пустое поле не ругаем при переходе дальше — только при отправке
    if (!child[field]) {
      return;
    }
    setErrors((previous) => ({ ...previous, [field]: validateChildField(field, child) }));
  }

  function submit() {
    if (submitting) {
      return;
    }
    Keyboard.dismiss();
    const found: ChildErrors = {};
    for (const field of CHILD_FIELD_ORDER) {
      const error = validateChildField(field, child);
      if (error) {
        found[field] = error;
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    dispatch(submitChildStart(toChildRequest(child)));
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      // На Android с edgeToEdgeEnabled система не сжимает окно под клавиатуру, поэтому padding нужен и там.
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          {immediate
            ? 'Ребёнок сразу появится в списке ваших детей. Если он уже есть в саду, мы привяжем его к вам.'
            : 'Укажите данные ребёнка. Администратор сада проверит их и добавит ребёнка в ваш список.'}
        </Text>
        <ChildFormCard
          index={0}
          title="Ребёнок"
          child={child}
          errors={errors}
          disabled={submitting}
          onChange={change}
          onBlur={validateOnBlur}
        />
        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={submit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting, busy: submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>{immediate ? 'Добавить' : 'Отправить заявку'}</Text>
          )}
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
    hint: {
      marginBottom: 16,
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
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
