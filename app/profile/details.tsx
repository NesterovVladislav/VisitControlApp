import { ProfileFields, ProfileIdentity } from '../../components/profile-person';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useProfileLayout } from '../../components/profile-layout';
import { ActionButton } from '../../components/ui';
import { useAppSelector } from '../../store';
import { formatBirthDate, formatPhoneForDisplay, genderLabel, roleLabel } from '../../utils/profile-format';

export default function ProfileDetails() {
  const layout = useProfileLayout();
  const router = useRouter();
  const user = useAppSelector(state => state.auth.user);
  if (!user) return null;
  const sections: [string, string | null | undefined][][] = [[
    ['Фамилия', user.surname], ['Имя', user.firstName], ['Отчество', user.patronymic],
    ['Дата рождения', formatBirthDate(user.birthDate)], ['Пол', genderLabel(user.gender)],
  ], [
    ['Телефон', formatPhoneForDisplay(user.phone)], ['Email', user.email],
  ]];

  return <ScrollView style={layout.screen} contentContainerStyle={layout.content}>
    <View style={layout.block}><ProfileIdentity {...user}
      subtitle={[roleLabel(user.role), user.organization?.name].filter(Boolean).join(' · ')} /></View>
    {sections.map((fields, index) => <ProfileFields key={index} fields={fields} />)}
    <ActionButton label="Редактировать" onPress={() => router.push('/profile/edit')} />
  </ScrollView>;
}
