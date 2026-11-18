import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { AbsenceDay, getAbsenceDay } from '../services/api/absence-day';
import { formatBirthDate } from '../utils/profile-format';
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

export function AbsenceDayEntry({ day }: { day: AbsenceDay | null }) {
  const router = useRouter();
  const c = usePalette();
  const styles = useStyles();

  if (!day?.absentChildren) return null;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Кого не будет ${formatBirthDate(day.date)}: ${day.absentChildren}`}
        onPress={() => router.push('/visits/absences')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.copy}>
          <Text style={styles.label}>Не придут {formatBirthDate(day.date)}</Text>
          {day.deadline ? (
            <Text style={styles.hint}>До срока — {day.absentChildren - day.lateChildren} · после срока — {day.lateChildren}</Text>
          ) : null}
        </View>
        <Text style={styles.count}>{day.absentChildren}</Text>
        <IconSymbol name="chevron.right" size={20} color={c.textSecondary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  container: { alignSelf: 'center', width: '100%', maxWidth: 440, paddingHorizontal: space.xl },
  row: {
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: radius.card,
    flexDirection: 'row',
    gap: space.sm,
    minHeight: controlHeight.touch,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  pressed: { backgroundColor: c.primarySoft },
  copy: { flex: 1 },
  label: { color: c.text, fontSize: typeSize.body, fontWeight: '600' },
  hint: { color: c.textSecondary, fontSize: typeSize.caption, marginTop: space.xxs },
  count: { color: c.actionPrimary, fontSize: typeSize.body, fontWeight: '700' },
}));
