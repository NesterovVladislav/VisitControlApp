import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppDispatch } from '../store';
import { logoutRequested } from '../store/reducers/auth';
import { useProfileLayout } from './profile-layout';
import { makeStyles } from '../hooks/use-palette';
import { controlHeight, space, typeSize } from '../constants/ui-tokens';
import { IconSymbol } from './ui/icon-symbol';

export const deletionForbidden = 'Аккаунт сотрудника удаляет администратор сада';

export function ProfileAccountActions({ role }: { role: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const layout = useProfileLayout();
  const s = useStyles();
  function logout() {
    Alert.alert('Выйти из аккаунта?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => dispatch(logoutRequested({ reason: 'user' })) },
    ]);
  }
  return <View style={layout.block}>
    <Pressable accessibilityRole="button" accessibilityLabel="О приложении" style={s.row} onPress={() => router.push('/profile/about')}>
      <Text style={s.text}>О приложении</Text><IconSymbol name="chevron.right" size={20} color={s.hint.color} />
    </Pressable>
    <Pressable accessibilityRole="button" style={[s.row, s.divider]} onPress={logout}>
      <Text style={s.text}>Выйти из аккаунта</Text>
    </Pressable>
    {role === 'PARENT' ? <Pressable accessibilityRole="button" accessibilityLabel="Удалить аккаунт" style={[s.row, s.divider]} onPress={() => router.push('/profile/delete-account')}>
      <Text style={[s.text, s.danger]}>Удалить аккаунт</Text><IconSymbol name="chevron.right" size={20} color={s.hint.color} />
    </Pressable> : <View style={[s.row, s.divider]}><Text style={s.hint}>{deletionForbidden}</Text></View>}
  </View>;
}

const useStyles = makeStyles(c => StyleSheet.create({
  row: { minHeight: controlHeight.field, flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  text: { flex: 1, fontSize: typeSize.body, color: c.text },
  hint: { color: c.textSecondary, fontSize: typeSize.label },
  danger: { color: c.danger },
}));
