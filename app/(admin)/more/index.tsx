import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProfileSummary from '@/components/profile-summary';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppDispatch, useAppSelector } from '../../../store';
import { logoutRequested, switchMode } from '../../../store/reducers/auth';
import { makeStyles, usePalette } from '../../../hooks/use-palette';

export default function MoreScreen() {
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const children = useAppSelector((state) => state.children.items);
  const user = useAppSelector((state) => state.auth.user);

  function goToParentMode() {
    dispatch(switchMode('parent'));
    router.replace('/children');
  }

  function confirmLogout() {
    Alert.alert('Выйти из аккаунта?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => dispatch(logoutRequested({ reason: 'user' })) },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {user ? (
        <TouchableOpacity
          style={[styles.card, styles.profile]}
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Профиль"
        >
          <ProfileSummary user={user} />
          <IconSymbol name="chevron.right" size={22} color={c.textTertiary} />
        </TouchableOpacity>
      ) : null}

      {/* Переключатель виден, только если у администратора есть свои дети */}
      {children.length > 0 ? (
        <TouchableOpacity
          style={[styles.card, styles.parentMode]}
          onPress={goToParentMode}
          accessibilityRole="button"
          accessibilityLabel="Режим родителя"
        >
          <IconSymbol name="figure.2.and.child.holdinghands" size={28} color={c.primary} />
          <View style={styles.parentModeText}>
            <Text style={styles.parentModeTitle}>Режим родителя</Text>
            <Text style={styles.parentModeChildren} numberOfLines={1}>
              {children.map((child) => child.firstName).join(', ')}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={22} color={c.textTertiary} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={confirmLogout} accessibilityRole="button">
          <Text style={styles.logout}>Выйти</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    card: {
      backgroundColor: c.card,
      borderRadius: 10,
      marginBottom: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    profile: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    parentMode: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    parentModeText: {
      flex: 1,
      marginLeft: 14,
    },
    parentModeTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
    },
    parentModeChildren: {
      marginTop: 2,
      fontSize: 14,
      color: c.textSecondary,
    },
    row: {
      padding: 16,
    },
    logout: {
      fontSize: 16,
      color: c.danger,
    },
  })
);
