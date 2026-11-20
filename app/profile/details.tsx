import { personName } from '@/utils/people-format';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useProfileLayout } from '../../components/profile-layout';
import Avatar from '../../components/avatar';
import { ActionButton } from '../../components/ui';
import { space, typeSize } from '../../constants/ui-tokens';
import { makeStyles } from '../../hooks/use-palette';
import { useAppSelector } from '../../store';
import { formatBirthDate, formatPhoneForDisplay, genderLabel, roleLabel } from '../../utils/profile-format';

export default function ProfileDetails() {
  const layout = useProfileLayout();
  const router = useRouter();
  const s = useStyles();
  const user = useAppSelector(state => state.auth.user);
  if (!user) return null;
  const sections = [[
    ['Фамилия', user.surname], ['Имя', user.firstName], ['Отчество', user.patronymic],
    ['Дата рождения', formatBirthDate(user.birthDate)], ['Пол', genderLabel(user.gender)],
  ], [
    ['Телефон', formatPhoneForDisplay(user.phone)], ['Email', user.email],
  ]];

  return <ScrollView style={layout.screen} contentContainerStyle={layout.content}>
    <View style={[layout.block, s.identity]}>
      <Avatar firstName={user.firstName} surname={user.surname} photoUrl={user.photoUrl} size={52} />
      <View style={s.summary}>
        <Text style={s.name}>{personName(user)}</Text>
        <Text style={s.hint}>{[roleLabel(user.role), user.organization?.name].filter(Boolean).join(' · ')}</Text>
      </View>
    </View>
    {sections.map((fields, index) => (
      <View key={index} style={layout.block}>
        {fields.map(([label, value]) => (
          <View key={label} style={s.field}>
            <Text style={s.hint}>{label}</Text>
            <Text style={s.value} selectable>{value || '—'}</Text>
          </View>
        ))}
      </View>
    ))}
    <ActionButton label="Редактировать" onPress={() => router.push('/profile/edit')} />
  </ScrollView>;
}
const useStyles = makeStyles(c => StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  summary: { flex: 1 },
  name: { color: c.text, fontSize: typeSize.sheetTitle, fontWeight: '600' },
  hint: { color: c.textSecondary, fontSize: typeSize.caption },
  field: { paddingVertical: space.sm, gap: space.xxs, borderColor: c.separator, borderBottomWidth: StyleSheet.hairlineWidth },
  value: { color: c.text, fontSize: typeSize.body },
}));
