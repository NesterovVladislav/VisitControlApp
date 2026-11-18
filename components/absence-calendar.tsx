import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles } from '../hooks/use-palette';
import { ActionButton } from './ui';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function absenceDateText(value: string): string {
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}.${month}.${year}` : '';
}

export function absenceRangeText(from: string, to: string): string {
  return from === to ? absenceDateText(from) : `${absenceDateText(from)} — ${absenceDateText(to)}`;
}

export default function AbsenceCalendar({ selected, min, max, range, isDateDisabled, onChoose }: {
  selected: string;
  min: string;
  max?: string;
  range?: { from: string; to: string | null };
  isDateDisabled?: (iso: string) => boolean;
  onChoose: (iso: string) => void;
}) {
  const styles = useStyles();
  const [month, setMonth] = useState(() => {
    const [year, monthNumber] = (selected >= min && (!max || selected <= max) ? selected : min).split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber - 1, 1));
  });
  const year = month.getUTCFullYear();
  const number = month.getUTCMonth();
  const offset = (month.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, number + 1, 0)).getUTCDate();
  const monthStart = month.toISOString().slice(0, 10);
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => i - offset + 1);

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <ActionButton variant="text" label="‹" accessibilityLabel="Предыдущий месяц"
          disabled={monthStart.slice(0, 7) <= min.slice(0, 7)}
          onPress={() => setMonth(new Date(Date.UTC(year, number - 1, 1)))} />
        <Text style={styles.title}>{MONTHS[number]} {year}</Text>
        <ActionButton variant="text" label="›" accessibilityLabel="Следующий месяц"
          disabled={Boolean(max && monthStart.slice(0, 7) >= max.slice(0, 7))}
          onPress={() => setMonth(new Date(Date.UTC(year, number + 1, 1)))} />
      </View>
      <View style={styles.row}>
        {DAYS.map((label) => <Text key={label} style={styles.weekday}>{label}</Text>)}
      </View>
      <View style={styles.grid}>
        {cells.map((day) => {
          if (day < 1 || day > days) return <View key={day} style={styles.cell} />;
          const iso = new Date(Date.UTC(year, number, day)).toISOString().slice(0, 10);
          const disabled = iso < min || Boolean(max && iso > max) || Boolean(isDateDisabled?.(iso));
          const active = iso === selected || iso === range?.from || iso === range?.to;
          const withinRange = Boolean(range?.to && iso > range.from && iso < range.to);
          return (
            <Pressable key={day} style={[styles.cell, withinRange && styles.withinRange, active && styles.active]} disabled={disabled}
              accessibilityRole="button" accessibilityLabel={absenceDateText(iso)}
              accessibilityState={{ disabled, selected: active || withinRange }} onPress={() => onChoose(iso)}>
              <Text style={[styles.text, disabled && styles.muted, active && styles.selected]}>{day}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  calendar: { gap: space.xs },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: c.text, fontSize: typeSize.body, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row' },
  cell: { width: '14.2857%', minHeight: controlHeight.touch, justifyContent: 'center', alignItems: 'center' },
  withinRange: { backgroundColor: c.primarySoft },
  active: { backgroundColor: c.actionPrimary, borderRadius: radius.control },
  selected: { color: c.onActionPrimary, fontWeight: '700' },
  text: { color: c.text, fontSize: typeSize.label },
  muted: { color: c.textTertiary },
  weekday: { width: '14.2857%', textAlign: 'center', color: c.textSecondary, fontSize: typeSize.caption },
}));
