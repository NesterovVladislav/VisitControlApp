import { StyleSheet, Text, View } from 'react-native';

import { radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles } from '../hooks/use-palette';
import type { AttendanceSummary } from '../services/api/own-attendance';
import { attendanceReason } from '../utils/attendance-reasons';
import { plural } from '../utils/plural';
import { ActionButton } from './ui';

export function AttendanceEntry({ childName, summary, onOpen }: {
  childName: string;
  summary?: AttendanceSummary;
  onOpen: () => void;
}) {
  const styles = useStyles();
  const visits = summary && summary.full + summary.half;
  return (
    <View style={styles.entry}>
      <ActionButton label="Посещения" variant="text" accessibilityLabel={`Посещения: ${childName}`} onPress={onOpen} />
      {summary && visits !== undefined && (
        <Text style={styles.caption}>
          {visits} {plural(visits, ['посещение', 'посещения', 'посещений'])}
          {' · '}{summary.absent} {plural(summary.absent, ['пропуск', 'пропуска', 'пропусков'])} за месяц
        </Text>
      )}
    </View>
  );
}

export function AttendanceOverview({ summary }: { summary: AttendanceSummary }) {
  const styles = useStyles();
  const totals = [
    { label: 'Полных дней', count: summary.full },
    { label: 'Полдня', count: summary.half },
    { label: 'Пропуски', count: summary.absent },
  ];

  return (
    <View style={styles.overview}>
      <Text style={styles.heading} accessibilityRole="header">Итоги за месяц</Text>
      <View style={styles.totals}>
        {totals.map(({ label, count }, index) => (
          <View key={label} style={[styles.total, index > 0 && styles.totalDivider]}>
            <Text style={styles.count}>{count}</Text>
            <Text style={styles.caption}>{label}</Text>
          </View>
        ))}
      </View>
      {summary.reasons.length > 0 && (
        <View style={styles.reasons} accessibilityLabel="Пропуски по причинам">
          {summary.reasons.map(({ reason, count }) => (
            <Text key={reason} style={styles.caption}>{attendanceReason(reason).label} · {count}</Text>
          ))}
        </View>
      )}
      {summary.paid > 0 && (
        <Text style={styles.payment}>Оплачиваемые пропуски: {summary.paid}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  entry: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator, marginTop: space.sm,
    paddingTop: space.xxs, paddingBottom: space.xxs, alignItems: 'center' },
  caption: { color: c.textSecondary, fontSize: typeSize.caption },
  overview: { backgroundColor: c.card, borderRadius: radius.card, gap: space.xs, padding: space.md },
  heading: { color: c.text, fontSize: typeSize.body, fontWeight: '700' },
  totals: { flexDirection: 'row' },
  total: { flex: 1, gap: space.xxs, paddingEnd: space.sm },
  totalDivider: { borderStartWidth: StyleSheet.hairlineWidth, borderColor: c.separator, paddingStart: space.sm },
  count: { color: c.text, fontSize: typeSize.sheetTitle, fontWeight: '700', fontVariant: ['tabular-nums'] },
  reasons: { gap: space.xxs },
  payment: { color: c.textSecondary, fontSize: typeSize.caption },
}));
