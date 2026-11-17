import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from '@/components/avatar';
import LinkChildSheet from '../../../components/link-child-sheet';
import { IconSymbol } from '../../../components/ui/icon-symbol';
import { useVisitListStyles } from '../../../components/visit-list';
import { makeStyles, usePalette } from '../../../hooks/use-palette';
import { useAppDispatch, useAppSelector } from '../../../store';
import { openChildLink } from '../../../store/reducers/child-link';
import {
  changePersonRole,
  clearDeactivation,
  clearPasswordReset,
  clearRoleChange,
  deactivatePerson,
  resetPersonPassword,
} from '../../../store/reducers/people';
import { Person, StaffRole } from '../../../store/types/people';
import {
  canDeactivate,
  canLinkChild,
  canResetPassword,
  isChild,
  passwordResetMessage,
  staffRoleChange,
} from '../../../utils/people-actions';
import { ageLabel, childSubtitle, linkLabel, personName } from '../../../utils/people-format';
import { formatBirthDate, formatPhoneForDisplay, fullName, roleLabel } from '../../../utils/profile-format';

/**
 * Карточка человека из «Людей»: данные из строки списка (отдельного GET /user/{key} пока нет) и все действия
 * администратора — позвонить, привязать ребёнка, сбросить пароль, деактивировать; директор ещё назначает и снимает
 * администраторов. Опасные действия — с подтверждением.
 */
export default function PersonCardScreen() {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = useAppSelector((state) => state.people.items.find((item) => item.id === id) ?? null);
  const { passwordReset, deactivation, roleChange, filterOptions } = useAppSelector((state) => state.people);
  const viewer = useAppSelector((state) => state.auth.user);
  // После деактивации человек пропадает из списка, а карточка ещё на экране до «OK»
  const lastPerson = useRef<Person | null>(found);
  if (found) {
    lastPerson.current = found;
  }
  const person = lastPerson.current;

  // Результат сброса пароля — диалогом, один раз
  useEffect(() => {
    if (!passwordReset || passwordReset.personId !== id || passwordReset.status === 'pending') {
      return;
    }
    const message = passwordResetMessage(passwordReset);
    if (message) {
      Alert.alert(message.title, message.text);
    }
    dispatch(clearPasswordReset());
  }, [passwordReset, id, dispatch]);

  // Деактивирован — карточка больше не нужна
  useEffect(() => {
    if (!deactivation || deactivation.personId !== id || deactivation.status === 'pending') {
      return;
    }
    if (deactivation.status === 'done') {
      Alert.alert('Пользователь деактивирован', undefined, [{ text: 'OK', onPress: () => router.back() }]);
    } else if (deactivation.message) {
      Alert.alert('Пользователь не деактивирован', deactivation.message);
    }
    dispatch(clearDeactivation());
  }, [deactivation, id, dispatch, router]);

  // Результат смены роли — диалогом, один раз
  useEffect(() => {
    if (!roleChange || roleChange.personId !== id || roleChange.status === 'pending') {
      return;
    }
    if (roleChange.status === 'done') {
      Alert.alert(roleChange.role === 'ADMIN' ? 'Назначен администратором' : 'Назначен сотрудником');
    } else if (roleChange.message) {
      Alert.alert('Роль не изменена', roleChange.message);
    }
    dispatch(clearRoleChange());
  }, [roleChange, id, dispatch]);

  if (!person) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={visitListStyles.message}>Пользователь не найден. Обновите список.</Text>
      </View>
    );
  }

  const child = isChild(person);
  const resetting = passwordReset?.personId === person.id && passwordReset.status === 'pending';
  const deactivating = deactivation?.personId === person.id && deactivation.status === 'pending';
  const changingRole = roleChange?.personId === person.id && roleChange.status === 'pending';
  const newRole = staffRoleChange(viewer, person);
  const phone = formatPhoneForDisplay(person.phone);

  function confirmResetPassword(target: Person) {
    Alert.alert(
      'Сбросить пароль?',
      `${personName(target)} получит новый пароль на ${target.email}. Старый пароль перестанет работать.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Сбросить', style: 'destructive', onPress: () => dispatch(resetPersonPassword(target.id)) },
      ],
      { cancelable: true }
    );
  }

  function confirmDeactivate(target: Person) {
    const consequence = isChild(target)
      ? `${personName(target)} пропадёт из списка «Люди».`
      : `${personName(target)} больше не сможет войти в приложение и пропадёт из списка «Люди».`;
    Alert.alert(
      'Деактивировать пользователя?',
      `${consequence} Вернуть доступ из приложения нельзя.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Деактивировать', style: 'destructive', onPress: () => dispatch(deactivatePerson(target.id)) },
      ],
      { cancelable: true }
    );
  }

  function confirmRoleChange(target: Person, role: StaffRole) {
    const toAdmin = role === 'ADMIN';
    Alert.alert(
      toAdmin ? 'Сделать администратором?' : 'Сделать сотрудником?',
      toAdmin
        ? `${personName(target)} получит полный доступ ко всем данным сада: заявки, люди, группы, сброс паролей.`
        : `${personName(target)} потеряет доступ к заявкам, людям и настройкам сада и сможет только смотреть, ` +
            'кто в саду, и отмечать посещения.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: toAdmin ? 'Сделать администратором' : 'Сделать сотрудником',
          style: toAdmin ? 'default' : 'destructive',
          onPress: () => dispatch(changePersonRole({ personId: target.id, role })),
        },
      ],
      { cancelable: true }
    );
  }

  const details: { label: string; value: string }[] = [];
  if (!child && person.role) details.push({ label: 'Роль', value: roleLabel(person.role) });
  if (person.email) details.push({ label: 'Email', value: person.email });
  const birthDate = formatBirthDate(person.birthDate);
  if (birthDate) {
    const age = ageLabel(person.birthDate);
    details.push({ label: 'Дата рождения', value: age ? `${birthDate} (${age})` : birthDate });
  }
  if (child) {
    details.push({ label: 'Группа', value: childSubtitle({ ...person, birthDate: null }, filterOptions.branches.length > 1) });
  }

  const actions: { key: string; label: string; onPress: () => void; destructive?: boolean; busy?: boolean }[] = [];
  if (canLinkChild(viewer, person)) {
    actions.push({ key: 'link', label: 'Привязать ребёнка', onPress: () => dispatch(openChildLink(person)) });
  }
  if (canResetPassword(viewer, person)) {
    actions.push({ key: 'reset', label: 'Сбросить пароль', onPress: () => confirmResetPassword(person), busy: resetting });
  }
  if (newRole) {
    actions.push({
      key: 'role',
      label: newRole === 'ADMIN' ? 'Сделать администратором' : 'Сделать сотрудником',
      onPress: () => confirmRoleChange(person, newRole),
      busy: changingRole,
    });
  }
  if (canDeactivate(viewer, person)) {
    actions.push({
      key: 'deactivate',
      label: 'Деактивировать',
      onPress: () => confirmDeactivate(person),
      destructive: true,
      busy: deactivating,
    });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar firstName={person.firstName} surname={person.surname} photoUrl={person.photoUrl} size={72} />
          <Text style={styles.name}>{fullName(person)}</Text>
          {child ? (
            <Text style={styles.headerSubtitle}>{person.present ? '● В саду' : '○ Не в саду'}</Text>
          ) : null}
        </View>

        {phone ? (
          <TouchableOpacity
            style={[styles.card, styles.callRow]}
            onPress={() => Linking.openURL(`tel:${person.phone}`)}
            accessibilityRole="button"
            accessibilityLabel={`Позвонить: ${personName(person)}`}
          >
            <IconSymbol name="phone.fill" size={20} color={c.primary} />
            <Text style={styles.callText}>{phone}</Text>
          </TouchableOpacity>
        ) : null}

        {details.length > 0 ? (
          <View style={styles.card}>
            {details.map((item, index) => (
              <View key={item.label} style={[styles.detail, index > 0 && styles.separated]}>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {person.children && person.children.length > 0 ? (
          <>
            <Text style={visitListStyles.sectionTitle}>ДЕТИ</Text>
            <View style={styles.card}>
              {person.children.map((item, index) => (
                <View key={item.id} style={[styles.detail, index > 0 && styles.separated]}>
                  <Text style={styles.detailValue}>{personName(item)}</Text>
                  <Text style={styles.detailLabel}>{linkLabel(item.linkRole, person.gender)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {actions.length > 0 ? (
          <>
            <Text style={visitListStyles.sectionTitle}>ДЕЙСТВИЯ</Text>
            <View style={styles.card}>
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={action.key}
                  style={[styles.action, index > 0 && styles.separated]}
                  onPress={action.onPress}
                  disabled={resetting || deactivating || changingRole}
                  accessibilityRole="button"
                >
                  <Text style={[styles.actionText, action.destructive && styles.destructive]}>{action.label}</Text>
                  {action.busy ? <ActivityIndicator color={c.textTertiary} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <LinkChildSheet showBranch={filterOptions.branches.length > 1} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    centered: {
      justifyContent: 'center',
      padding: 20,
    },
    content: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 20,
    },
    name: {
      marginTop: 12,
      fontSize: 20,
      fontWeight: '600',
      color: c.text,
      textAlign: 'center',
    },
    headerSubtitle: {
      marginTop: 4,
      fontSize: 15,
      color: c.textSecondary,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 12,
      marginBottom: 20,
      overflow: 'hidden',
    },
    callRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    callText: {
      marginLeft: 12,
      fontSize: 16,
      color: c.primary,
    },
    detail: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    separated: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
    },
    detailLabel: {
      fontSize: 15,
      color: c.textSecondary,
      marginRight: 12,
    },
    detailValue: {
      flexShrink: 1,
      fontSize: 15,
      color: c.text,
      textAlign: 'right',
    },
    action: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    actionText: {
      fontSize: 16,
      color: c.primary,
    },
    destructive: {
      color: c.danger,
    },
  })
);
