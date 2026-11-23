import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { AbsenceDay, getAbsenceDay } from '../services/api/absence-day';
import Ionicons from '@expo/vector-icons/Ionicons';
import { absenceEntrySummary } from '../utils/absence-day-labels';
import { IconSymbol } from './ui/icon-symbol';

export function useAbsenceDayEntry(enabled: boolean) {
  const [day, setDay] = useState<AbsenceDay | null>(null);
  const active = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    getAbsenceDay(undefined, controller.signal).then(
      (report) => { if (!controller.signal.aborted) setDay(report); },
      () => { if (!controller.signal.aborted) setDay(null); },
    );
  }, []);

  useFocusEffect(useCallback(() => {
    if (!enabled) {
      setDay(null);
      return;
    }
    reload();
    return () => active.current?.abort();
  }, [enabled, reload]));

  return { day, reload };
}

export function AbsenceDayEntry({ day, groupId, groupName }: { day: AbsenceDay | null; groupId?: string | null; groupName?: string }) {
  const router = useRouter();
  const c = usePalette();
  const styles = useStyles();

  const group = groupId && day?.branches.flatMap(branch => branch.groups).find(item => item.id === groupId);
  const count = groupId ? (group ? group.absences.length : undefined) : day?.absentChildren;
  const hint = day && count != null ? absenceEntrySummary(day.date, count) : 'Открыть список';

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Кого не будет. ${hint}`}
        onPress={() => router.push({ pathname: '/visits/absences', params: {
          ...(day && { date: day.date }), ...(groupId && { groupId, groupName: groupName ?? (group && group.name) ?? '' }),
        } })}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.icon}><Ionicons name="calendar-outline" size={20} color={c.actionPrimary} /></View>
        <View style={styles.copy}>
          <Text style={styles.label}>Кого не будет</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
        <IconSymbol name="chevron.right" size={20} color={c.textSecondary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  container: { alignSelf: 'center', width: '100%', maxWidth: 480, paddingHorizontal: space.lg, paddingTop: space.md },
  row: {
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: radius.card,
    flexDirection: 'row',
    gap: space.md,
    minHeight: controlHeight.touch,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  pressed: { backgroundColor: c.primarySoft },
  icon: { width: 34, height: 34, borderRadius: radius.control, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  label: { color: c.text, fontSize: typeSize.body, fontWeight: '600' },
  hint: { color: c.textSecondary, fontSize: typeSize.caption, marginTop: space.xxs },
}));
