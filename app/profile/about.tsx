import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useProfileLayout } from '../../components/profile-layout';
import { controlHeight, radius, space, typeSize } from '../../constants/ui-tokens';
import { makeStyles } from '../../hooks/use-palette';
import { getAppVersion } from '../../utils/app-version';

export default function AboutScreen() {
  const { version, build } = getAppVersion();
  const layout = useProfileLayout();
  const s = useStyles();
  return <ScrollView style={layout.screen} contentContainerStyle={layout.content}>
    <View style={layout.block}>
      <View style={s.identity}>
        <Image accessible={false} source={require('../../assets/images/icon.png')} style={s.icon} />
        <Text style={s.name}>ДоброВход</Text>
      </View>
      <View style={s.row}>
        <Text style={s.label}>Версия</Text>
        <Text style={s.value} selectable>{version || 'Недоступна'}</Text>
      </View>
      {build && <View style={s.row}>
        <Text style={s.label}>Сборка</Text>
        <Text style={s.value} selectable>{build}</Text>
      </View>}
    </View>
  </ScrollView>;
}
const useStyles = makeStyles(c => StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  icon: { width: 44, height: 44, borderRadius: radius.control },
  name: { color: c.text, fontSize: typeSize.sheetTitle, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm,
    minHeight: controlHeight.field, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  label: { color: c.text, fontSize: typeSize.body },
  value: { color: c.text, fontSize: typeSize.body, fontWeight: '600', flexShrink: 1 },
}));
