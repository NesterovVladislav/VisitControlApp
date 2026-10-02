import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProfileSummary from '@/components/profile-summary';
import SegmentedControl from '@/components/segmented-control';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppDispatch, useAppSelector } from '../../store';
import { logoutRequested } from '../../store/reducers/auth';
import { refreshProfile } from '../../store/reducers/profile';
import { ADMIN_ROLE } from '../../store/types/auth';
import { formatBirthDate, formatPhoneForDisplay, genderLabel } from '../../utils/profile-format';
import { makeStyles, usePalette } from '../../hooks/use-palette';
import { useThemePreference } from '../../hooks/use-theme-preference';
import { ThemePreference } from '../../services/theme/theme-preference';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Системная' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
];

interface Row {
  label: string;
  value: string | null;
}

function InfoCard({ title, rows }: { title: string; rows: Row[] }) {
  const styles = useStyles();
  // Пустые поля (нет отчества, нет телефона) не показываем
  const filled = rows.filter((row): row is { label: string; value: string } => Boolean(row.value));
  if (filled.length === 0) {
    return null;
  }
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {filled.map((row, index) => (
          <View key={row.label} style={[styles.infoRow, index > 0 && styles.rowBorder]}>
            <Text style={styles.infoLabel}>{row.label}</Text>
            <Text style={styles.infoValue} selectable>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

/**
 * Профиль: личные данные, смена пароля, тема оформления и выход. См. docs/profile-screen.md.
 * Свои данные меняет сам только администратор (кнопка «Изменить»), остальные — через администратора.
 */
export default function ProfileScreen() {
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const refreshing = useAppSelector((state) => state.profile.refreshing);
  const [theme, setTheme] = useThemePreference();

  // Администратор мог подтвердить изменение данных, пока приложение было открыто
  useFocusEffect(
    useCallback(() => {
      dispatch(refreshProfile());
    }, [dispatch])
  );

  function confirmLogout() {
    Alert.alert('Выйти из аккаунта?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => dispatch(logoutRequested({ reason: 'user' })) },
    ]);
  }

  if (!user) {
    return null;
  }

  const canEdit = user.role === ADMIN_ROLE;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => dispatch(refreshProfile({ pull: true }))} />
      }
    >
      <Stack.Screen
        options={{
          headerRight: canEdit
            ? () => (
                <TouchableOpacity
                  onPress={() => router.push('/profile/edit')}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={styles.headerButton}>Изменить</Text>
                </TouchableOpacity>
              )
            : undefined,
        }}
      />
      <View style={[styles.card, styles.summary]}>
        <ProfileSummary user={user} />
      </View>

      <InfoCard
        title="ЛИЧНЫЕ ДАННЫЕ"
        rows={[
          { label: 'Дата рождения', value: formatBirthDate(user.birthDate) },
          { label: 'Пол', value: genderLabel(user.gender) },
        ]}
      />
      <InfoCard
        title="КОНТАКТЫ"
        rows={[
          { label: 'Email', value: user.email || null },
          { label: 'Телефон', value: formatPhoneForDisplay(user.phone) },
        ]}
      />

      {canEdit ? null : (
        <Text style={styles.note}>
          Изменить личные данные может только администратор сада после проверки. Если что-то указано неверно,
          обратитесь к нему.
        </Text>
      )}

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/profile/password')}
          accessibilityRole="button"
        >
          <Text style={styles.action}>Сменить пароль</Text>
          <IconSymbol name="chevron.right" size={22} color={c.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>ОФОРМЛЕНИЕ</Text>
      <View style={[styles.card, styles.themeCard]}>
        <SegmentedControl options={THEME_OPTIONS} value={theme} onChange={setTheme} />
        <Text style={styles.themeHint}>
          {theme === 'system' ? 'Светлая или тёмная — как в настройках телефона' : 'Выбор сохраняется на этом устройстве'}
        </Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.actionRow} onPress={confirmLogout} accessibilityRole="button">
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
    themeCard: {
      padding: 16,
    },
    themeHint: {
      // У переключателя свой отступ снизу
      marginTop: -6,
      fontSize: 13,
      color: c.textSecondary,
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
    summary: {
      flexDirection: 'row',
      padding: 16,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: c.textTertiary,
      marginBottom: 8,
      marginLeft: 4,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    infoLabel: {
      fontSize: 15,
      color: c.textSecondary,
      marginRight: 12,
    },
    infoValue: {
      flexShrink: 1,
      fontSize: 15,
      color: c.text,
      textAlign: 'right',
    },
    headerButton: {
      color: c.primary,
      fontSize: 16,
    },
    note: {
      fontSize: 13,
      color: c.textSecondary,
      lineHeight: 18,
      marginTop: -4,
      marginBottom: 20,
      marginHorizontal: 4,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    action: {
      fontSize: 16,
      color: c.text,
    },
    logout: {
      fontSize: 16,
      color: c.danger,
    },
  })
);
