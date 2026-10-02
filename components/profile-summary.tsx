import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { User } from '@/store/types/auth';
import { fullName, initials, roleLabel } from '@/utils/profile-format';
import { makeStyles } from '../hooks/use-palette';

/**
 * Инициалы, ФИО и роль пользователя — в шапке профиля и в карточке во вкладке «Ещё».
 */
export default function ProfileSummary({ user }: { user: User }) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.avatarText}>{initials(user)}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.name}>{fullName(user)}</Text>
        <Text style={styles.role}>{roleLabel(user.role)}</Text>
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
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 19,
      fontWeight: '600',
      color: c.primary,
    },
    text: {
      flex: 1,
      marginLeft: 14,
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
  })
);
