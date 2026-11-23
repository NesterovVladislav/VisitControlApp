import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { makeStyles, usePalette } from '../hooks/use-palette';
import type { AbsenceRules } from '../services/api/absence';
import { radius, space, typeSize } from '../constants/ui-tokens';

const monthName = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export function periodLabel(from: string, to: string, today: string) {
  const date = (value: string) => {
    const label = monthName.format(new Date(value + 'T00:00:00Z'));
    return value.slice(0, 4) === today.slice(0, 4) ? label : label + ' ' + value.slice(0, 4);
  };
  if (from === to) return date(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return Number(from.slice(-2)) + '–' + date(to);
  return date(from) + ' — ' + date(to);
}

function FittingSummary({ options }: { options: string[] }) {
  const s = useStyles();
  const [available, setAvailable] = useState(0);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const label = options.find(option => widths[option] !== undefined && widths[option] <= available) ?? options[options.length - 1];
  return <View onLayout={event => setAvailable(event.nativeEvent.layout.width)} style={s.fit}>
    <Text style={s.summary}>{label}</Text>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={s.measure}>
      {options.map(option => <Text key={option} style={s.summary} onLayout={event => {
        const width = event.nativeEvent.layout.width;
        setWidths(old => old[option] === width ? old : { ...old, [option]: width });
      }}>{option}</Text>)}
    </View>
  </View>;
}

export function CalendarAbsenceEntry({ rules, onPress }: { rules: AbsenceRules; onPress: () => void }) {
  const s = useStyles();
  const c = usePalette();
  const { fontScale } = useWindowDimensions();
  const entry = rules.current;
  let options = ['Ничего не запланировано'];
  if (entry) {
    const range = periodLabel(entry.from, entry.to, rules.today_date);
    const current = entry.from <= rules.today_date && rules.today_date <= entry.to;
    const prefix = (current ? 'Сейчас — ' : 'Ближайшее — ') + range;
    const reason = rules.reasons.find(r => r.code === entry.reason)?.name;
    options = reason ? [prefix + ' · ' + reason.toLocaleLowerCase('ru-RU'), prefix, range] : [prefix, range];
  }
  return <Pressable accessibilityRole="button" accessibilityLabel={'Отсутствия. ' + options[0]} style={s.entry} onPress={onPress}>
    <View style={s.icon}><Ionicons name="calendar-outline" size={19} color={c.actionPrimary} /></View>
    <View style={s.copy}><Text style={s.title}>Отсутствия</Text><FittingSummary key={fontScale} options={options} /></View>
    <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
  </Pressable>;
}

const useStyles = makeStyles(c => StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.card,
    backgroundColor: c.card, paddingHorizontal: space.md, paddingVertical: space.md },
  icon: { width: 34, height: 34, backgroundColor: c.primarySoft, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: c.text, fontSize: typeSize.body, fontWeight: '600' },
  fit: { overflow: 'hidden' },
  summary: { color: c.textSecondary, fontSize: typeSize.label },
  measure: { position: 'absolute', top: 0, left: 0, width: 3000, alignItems: 'flex-start', opacity: 0 },
}));
