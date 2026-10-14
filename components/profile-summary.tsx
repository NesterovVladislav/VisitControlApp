import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { User } from '@/store/types/auth';
import { fullName, roleLabel } from '@/utils/profile-format';
import Avatar from './avatar';
import { makeStyles } from '../hooks/use-palette';

/**
 * Фотография (или инициалы), ФИО, роль и сад пользователя — в шапке профиля и в карточке во вкладке «Ещё».
 * Сад сервер определяет по аккаунту, поэтому при входе его не выбирают, а показывают здесь.
 * hideAvatar — в профиле фотография стоит отдельно, крупно и с кнопкой замены.
 */
export default function ProfileSummary({ user, hideAvatar = false }: { user: User; hideAvatar?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      {hideAvatar ? null : (
        <Avatar firstName={user.firstName} surname={user.surname} photoUrl={user.photoUrl} size={52} />
      )}
      <View style={[styles.text, hideAvatar && styles.textAlone]}>
        <Text style={styles.name}>{fullName(user)}</Text>
        <Text style={styles.role}>{roleLabel(user.role)}</Text>
        {user.organization ? (
          <Text style={styles.organization} numberOfLines={2}>
            {user.organization.name}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    text: {
      flex: 1,
      marginLeft: 14,
    },
    textAlone: {
      marginLeft: 0,
    },
    name: {
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
    },
    role: {
      marginTop: 2,
      fontSize: 14,
      color: c.textSecondary,
    },
    organization: {
      marginTop: 2,
      fontSize: 14,
      color: c.textTertiary,
    },
  })
);
