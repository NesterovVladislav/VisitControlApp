import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { themeLabels } from '../../services/theme/theme-preference';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { controlHeight, space, typeSize } from '../../constants/ui-tokens';
import { makeStyles, usePalette } from '../../hooks/use-palette';
import { useThemePreference } from '../../hooks/use-theme-preference';

export default function ThemeScreen() {
  const c = usePalette();
  const s = useStyles();
  const [theme, setTheme] = useThemePreference();
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    {(['system', 'light', 'dark'] as const).map(value => <Pressable key={value} style={s.row}
      accessibilityRole="radio" accessibilityState={{ checked: theme === value }}
      onPress={() => setTheme(value)}>
      <Text style={s.label}>{themeLabels[value]}</Text>
      {theme === value && <IconSymbol name="checkmark" size={22} color={c.actionPrimary} />}
    </Pressable>)}
  </ScrollView>;
}

const useStyles = makeStyles(c => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.card },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: controlHeight.action, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator, paddingVertical: space.md },
  label: { flex: 1, fontSize: typeSize.body, color: c.text },
}));
