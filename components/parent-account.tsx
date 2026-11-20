import { personName } from '@/utils/people-format';
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
import { useProfileLayout } from './profile-layout';
import { canAddChild } from '../utils/child-requests';
import Avatar from './avatar';
import ProfileChildren from './profile-children';
import { IconSymbol } from './ui/icon-symbol';
import { RefreshControl } from './ui/refresh-control';

function AccountRow({ label, value, onPress, divider }: { label: string; value?: string; onPress: () => void; divider?: boolean }) {
  const s = useStyles();
  const c = usePalette();
  return (
    <Pressable accessibilityRole="button" style={[s.row, divider && s.divider]} onPress={onPress}>
      <Text style={s.label}>{label}</Text>
      {value && <Text style={s.value}>{value}</Text>}
      <IconSymbol name="chevron.right" size={20} color={c.textSecondary} />
    </Pressable>
  );
}

export default function ParentAccount() {
  const s = useStyles();
  const layout = useProfileLayout();
  const c = usePalette();
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
    <ScrollView style={layout.screen} contentContainerStyle={layout.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => dispatch(refreshProfile({ pull: true }))} />}>
      <Pressable accessibilityRole="button" accessibilityLabel={personName(user) + ', Личные данные'}
        style={[layout.block, s.identity]} onPress={() => router.push('/profile/details')}>
        <Avatar firstName={user.firstName} surname={user.surname} photoUrl={user.photoUrl} size={50} />
        <View style={s.identityText}>
          <Text style={s.name}>{personName(user)}</Text>
          <Text style={s.value}>Личные данные</Text>
        </View>
        <IconSymbol name="chevron.right" size={20} color={c.textSecondary} />
      </Pressable>
      {canAddChild(user.role) && <View style={layout.block}><ProfileChildren compact /></View>}
      <View style={layout.block}>
        <Text style={s.section} accessibilityRole="header">Настройки</Text>
        <AccountRow label="Сменить пароль" divider onPress={() => router.push('/profile/password')} />
        <AccountRow label="Тема" divider value={themeLabels[theme]} onPress={() => router.push('/profile/theme')} />
        <AccountRow label="О приложении" onPress={() => router.push('/profile/about')} />
      </View>
      {isStaffRole(user.role) && <View style={layout.block}>
        <AccountRow label={isAdminRole(user.role) ? 'Режим администратора' : 'Режим сотрудника'} onPress={() => {
          dispatch(switchMode('admin'));
          router.replace('/visits');
        }} />
      </View>}
      <Pressable accessibilityRole="button" style={s.logout} onPress={logout}>
        <Text style={s.logoutText}>Выйти из аккаунта</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles(c => StyleSheet.create({
  identity: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.lg },
  identityText: { flex: 1, gap: space.xxs },
  name: { color: c.text, fontSize: typeSize.sheetTitle, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: controlHeight.field, gap: space.sm, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  label: { color: c.text, fontSize: typeSize.body, flex: 1 },
  value: { color: c.textSecondary, fontSize: typeSize.label },
  section: { marginBottom: space.xxs, fontWeight: '600', fontSize: typeSize.navigationTitle, color: c.text },
  logout: { paddingHorizontal: space.lg, minHeight: controlHeight.touch, justifyContent: 'center' },
  logoutText: { color: c.danger, fontSize: typeSize.body },
}));
