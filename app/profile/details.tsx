import { personName } from '@/utils/people-format';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Avatar from '../../components/avatar';
import { ActionButton } from '../../components/ui';
import { space, typeSize } from '../../constants/ui-tokens';
import { makeStyles } from '../../hooks/use-palette';
import { useAppSelector } from '../../store';
import { formatBirthDate, formatPhoneForDisplay, genderLabel, roleLabel } from '../../utils/profile-format';

export default function ProfileDetails() {
  const router = useRouter();
  const s = useStyles();
  const user = useAppSelector(state => state.auth.user);
  if (!user) return null;
  const fields = [
    ['Фамилия', user.surname], ['Имя', user.firstName], ['Отчество', user.patronymic],
    ['Дата рождения', formatBirthDate(user.birthDate)], ['Пол', genderLabel(user.gender)],
    ['Телефон', formatPhoneForDisplay(user.phone)], ['Email', user.email],
  ];

  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <View style={s.identity}>
      <Avatar firstName={user.firstName} surname={user.surname} photoUrl={user.photoUrl} size={52} />
      <View style={s.summary}>
        <Text style={s.name}>{personName(user)}</Text>
        <Text style={s.hint}>{[roleLabel(user.role), user.organization?.name].filter(Boolean).join(' · ')}</Text>
      </View>
    </View>
    {fields.map(([label, value]) => <View key={label} style={s.field}>
      <Text style={s.hint}>{label}</Text>
      <Text style={s.value} selectable>{value || '—'}</Text>
    </View>)}
    <View style={s.action}><ActionButton label="Редактировать" onPress={() => router.push('/profile/edit')} /></View>
  </ScrollView>;
}
const useStyles = makeStyles(c => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.card },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: space.xl },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  summary: { flex: 1 },
  name: { color: c.text, fontSize: typeSize.sheetTitle, fontWeight: '600' },
  hint: { color: c.textSecondary, fontSize: typeSize.caption },
  field: { paddingVertical: space.sm, gap: space.xxs, borderColor: c.separator, borderBottomWidth: StyleSheet.hairlineWidth },
  value: { color: c.text, fontSize: typeSize.body },
  action: { marginTop: space.lg },
}));
