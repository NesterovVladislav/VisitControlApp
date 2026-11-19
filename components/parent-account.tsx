import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { controlHeight, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { themeLabels } from '../services/theme/theme-preference';
import { useThemePreference } from '../hooks/use-theme-preference';
import { useAppDispatch, useAppSelector } from '../store';
import { logoutRequested, switchMode } from '../store/reducers/auth';
import { refreshProfile } from '../store/reducers/profile';
import { isAdminRole, isStaffRole } from '../store/types/auth';
import { getAppVersionLabel } from '../utils/app-version';
import { canAddChild } from '../utils/child-requests';
import Avatar from './avatar';
import ProfileChildren from './profile-children';
import { IconSymbol } from './ui/icon-symbol';
import { RefreshControl } from './ui/refresh-control';

function AccountRow({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  const s = useStyles();
  const c = usePalette();
  return (
    <Pressable accessibilityRole="button" style={s.row} onPress={onPress}>
      <Text style={s.label}>{label}</Text>
      {value && <Text style={s.value}>{value}</Text>}
      <IconSymbol name="chevron.right" size={20} color={c.textSecondary} />
    </Pressable>
  );
}

export default function ParentAccount() {
  const s = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const refreshing = useAppSelector(state => state.profile.refreshing);
  const [theme] = useThemePreference();
  useFocusEffect(useCallback(() => { dispatch(refreshProfile()); }, [dispatch]));
  if (!user) return null;
  function logout() {
    Alert.alert('Выйти из аккаунта?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => dispatch(logoutRequested({ reason: 'user' })) },
    ]);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => dispatch(refreshProfile({ pull: true }))} />}>
      <View style={s.identity}>
        <Avatar firstName={user.firstName} surname={user.surname} photoUrl={user.photoUrl} size={60} />
        <Text style={s.name}>{[user.firstName, user.surname].filter(Boolean).join(' ')}</Text>
      </View>
      <AccountRow label="Личные данные" onPress={() => router.push('/profile/details')} />
      {canAddChild(user.role) && <ProfileChildren compact />}
      <Text style={s.section}>Настройки</Text>
      <AccountRow label="Сменить пароль" onPress={() => router.push('/profile/password')} />
      <AccountRow label="Тема" value={themeLabels[theme]} onPress={() => router.push('/profile/theme')} />
      {isStaffRole(user.role) && <AccountRow label={isAdminRole(user.role) ? 'Режим администратора' : 'Режим сотрудника'} onPress={() => {
        dispatch(switchMode('admin'));
        router.replace('/visits');
      }} />}
      <Pressable accessibilityRole="button" style={s.logout} onPress={logout}>
        <Text style={s.logoutText}>Выйти из аккаунта</Text>
      </Pressable>
      <Text style={s.version} selectable>{getAppVersionLabel()}</Text>
    </ScrollView>
  );
}

const useStyles = makeStyles(c => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.card },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: space.xl, paddingTop: space.section },
  identity: { flexDirection: 'row', gap: space.lg, alignItems: 'center', marginBottom: space.lg },
  name: { flex: 1, color: c.text, fontSize: typeSize.title, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: controlHeight.action, gap: space.sm,
    paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  label: { color: c.text, fontSize: typeSize.body, flex: 1 },
  value: { color: c.textSecondary, fontSize: typeSize.label },
  section: { marginTop: space.section, fontWeight: '600', fontSize: typeSize.navigationTitle, color: c.text },
  logout: { marginTop: space.xl, minHeight: controlHeight.touch, justifyContent: 'center' },
  logoutText: { color: c.danger, fontSize: typeSize.body },
  version: { color: c.textSecondary, marginTop: space.xs, fontSize: typeSize.caption },
}));
