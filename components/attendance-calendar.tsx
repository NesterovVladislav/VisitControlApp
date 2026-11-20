import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState, type ElementRef, type KeyboardEvent } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles } from '../hooks/use-palette';
import type { AttendanceDay } from '../services/api/own-attendance';
import { attendanceReason, attendanceReasons } from '../utils/attendance-reasons';
import { calendarMonth, weekdays } from '../utils/calendar-month';
import { formatBirthDate } from '../utils/profile-format';
import { ActionButton, BottomSheet } from './ui';

const dayOffsets: Record<string, number | undefined> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -weekdays.length,
  ArrowDown: weekdays.length,
};
const paidLabel = 'Оплачиваемый пропуск';
const nonworkingSymbol = '×';

type Mark = {
  tone: 'visit' | 'absence' | 'planned' | 'inactive' | 'plain';
  symbol?: string;
  label: string;
};

function dayMark(day: AttendanceDay): Mark {
  switch (day.status) {
    case 'FULL': return { tone: 'visit', symbol: '✓', label: 'Полный день' };
    case 'FIRST_HALF': return { tone: 'visit', symbol: '◩', label: 'Первая половина дня' };
    case 'SECOND_HALF': return { tone: 'visit', symbol: '◪', label: 'Вторая половина дня' };
    case 'NOT_IN_GROUP': return { tone: 'inactive', symbol: '–', label: 'Вне группы' };
    case 'NONE': break;
  }
  if (day.reason) {
    const reason = attendanceReason(day.reason);
    return {
      tone: day.future ? 'planned' : 'absence',
      symbol: reason.mark,
      label: `${day.future ? 'Запланированный пропуск' : 'Пропуск'} · ${reason.label}`,
    };
  }
  if (!day.working) return { tone: 'inactive', symbol: nonworkingSymbol, label: 'Нерабочий день' };
  if (day.future) return { tone: 'plain', label: 'Будущий день' };
  return { tone: 'plain', symbol: '·', label: 'Нет отметки' };
}

function AttendanceDayDetails({ day, onClose, onOpenPeriod }: { day: AttendanceDay; onClose: () => void; onOpenPeriod?: () => void }) {
  const styles = useStyles();
  const { absencePeriod } = day;
  return (
    <BottomSheet title={formatBirthDate(day.date) ?? ''} onClose={onClose}>
      <View style={styles.sheetContent}>
        <Text style={styles.sheetText}>{dayMark(day).label}</Text>
        {day.holiday && <Text style={styles.sheetText}>{day.holiday}</Text>}
        {absencePeriod && onOpenPeriod ? <ActionButton label={'Период отсутствия: ' + formatBirthDate(absencePeriod.from) + ' — ' + formatBirthDate(absencePeriod.to)} variant="text" onPress={onOpenPeriod} /> : absencePeriod && (
          <Text style={styles.sheetText}>
            {formatBirthDate(absencePeriod.from)} — {formatBirthDate(absencePeriod.to)}
          </Text>
        )}
        {day.paid && <Text style={styles.sheetText}>{paidLabel}</Text>}
      </View>
    </BottomSheet>
  );
}

export function AttendanceMonthHeader({ label, onPrevious, onNext, canNext, onLegend }: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  canNext: boolean;
  onLegend?: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.monthHeader}>
      <ActionButton variant="text" label="‹" accessibilityLabel="Предыдущий месяц" onPress={onPrevious} />
      <View style={styles.monthCenter}>
        <Text style={styles.monthTitle} accessibilityRole="header" aria-live="polite">{label}</Text>
        {onLegend && <Pressable accessibilityRole="button" accessibilityLabel="Обозначения" onPress={onLegend} style={styles.info}>
          <Ionicons name="information-circle-outline" size={20} color={styles.info.color} />
        </Pressable>}
      </View>
      <ActionButton variant="text" label="›" accessibilityLabel="Следующий месяц" disabled={!canNext} onPress={onNext} />
    </View>
  );
}

export function AttendanceCalendar({ month, days, today, showLegend, onCloseLegend, onOpenPeriod, compact, inlineMarks, initialOpenDate, onDayClosed }: {
  initialOpenDate?: string; onDayClosed?: () => void;
  showLegend?: boolean; onCloseLegend?: () => void; onOpenPeriod?: (day: AttendanceDay) => void; compact?: boolean; inlineMarks?: boolean;
  month: ReturnType<typeof calendarMonth>;
  days: AttendanceDay[];
  today: string;
}) {
  const styles = useStyles();
  const [legend, setLegend] = useState(false);
  const [openDate, setOpenDate] = useState(initialOpenDate);
  const [tabDate, setTabDate] = useState<string>();
  const [focusedDate, setFocusedDate] = useState<string>();
  const dateButtons = useRef(new Map<string, ElementRef<typeof Pressable>>());
  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const selectedDay = openDate ? daysByDate.get(openDate) : undefined;
  const tabbableDate = tabDate && daysByDate.has(tabDate) ? tabDate :
    daysByDate.has(today) ? today : month.cells.find((date) => date && daysByDate.has(date));
  const rowStarts = Array.from({ length: month.cells.length / weekdays.length }, (_, row) => row * weekdays.length);

  function moveDate(event: KeyboardEvent, index: number) {
    const offset = dayOffsets[event.key];
    if (offset === undefined || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    event.preventDefault();
    const nextDate = month.cells[index + offset];
    if (nextDate) dateButtons.current.get(nextDate)?.focus();
  }

  return (
    <>
      <View style={styles.week}>
        {weekdays.map((weekday) => <Text key={weekday} style={styles.weekday}>{weekday}</Text>)}
      </View>
      <View>
        {rowStarts.map((start) => (
          <View key={start} style={styles.week}>
            {month.cells.slice(start, start + weekdays.length).map((date, column) => {
              const day = date ? daysByDate.get(date) : undefined;
              if (!day) return <View key={column} style={styles.cell} />;
              const mark = dayMark(day);
              const isToday = day.date === today;
              const label = [
                formatBirthDate(day.date), isToday && 'Сегодня', mark.label, day.holiday, day.paid && paidLabel,
              ].filter(Boolean).join(' · ');
              const webProps = Platform.OS === 'web' ? {
                tabIndex: day.date === tabbableDate ? 0 as const : -1 as const,
                'aria-haspopup': 'dialog',
                'aria-current': isToday ? 'date' as const : undefined,
                onKeyDown: (event: KeyboardEvent) => moveDate(event, start + column),
                onFocus: () => {
                  setTabDate(day.date);
                  setFocusedDate(day.date);
                },
                onBlur: () => setFocusedDate(undefined),
                ref: (button: ElementRef<typeof Pressable> | null) => {
                  if (button) dateButtons.current.set(day.date, button);
                  else dateButtons.current.delete(day.date);
                },
              } : {};

              return (
                <Pressable key={day.date} style={styles.cell} accessibilityLabel={label} accessibilityRole="button"
                  onPress={() => setOpenDate(day.date)} {...webProps}>
                  {({ pressed }) => (
                    <View style={[styles.day, compact && styles.compactDay, inlineMarks && styles.inlineDay, styles[mark.tone], isToday && styles.today,
                      pressed && styles.pressed, focusedDate === day.date && styles.focused]}>
                      <Text style={[styles.dayNumber, mark.tone === 'inactive' && styles.secondary]}>
                        {Number(day.date.slice(-2))}
                      </Text>
                      <Text style={[styles.symbol, mark.tone === 'visit' && styles.visitedSymbol,
                        mark.tone === 'absence' && styles.paid, mark.tone === 'planned' && styles.plannedSymbol]}>
                        {mark.symbol ?? (inlineMarks ? '' : '\u00a0')}{day.paid && <Text style={styles.paid}>{inlineMarks ? '₽' : ' ₽'}</Text>}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {showLegend === undefined && <View style={styles.legendAction}>
        <ActionButton variant="text" label="Обозначения" onPress={() => setLegend(true)} />
      </View>}
      {(showLegend ?? legend) && (
        <BottomSheet title="Обозначения" onClose={onCloseLegend ?? (() => setLegend(false))}>
          <View style={styles.sheetContent}>
            <Text style={styles.sheetText}>✓ Полный день</Text>
            <Text style={styles.sheetText}>◩ Первая половина дня</Text>
            <Text style={styles.sheetText}>◪ Вторая половина дня</Text>
            {Object.values(attendanceReasons).map((reason) => (
              <Text key={reason.mark} style={styles.sheetText}>{reason.mark} {reason.label}</Text>
            ))}
            <Text style={styles.sheetText}>Пунктирная рамка · запланированный пропуск</Text>
            <Text style={styles.sheetText}>Знак рубля · оплачиваемый пропуск</Text>
            <Text style={styles.sheetText}>· Нет отметки</Text>
            <Text style={styles.sheetText}>{nonworkingSymbol} Нерабочий день</Text>
            <Text style={styles.sheetText}>– Вне группы</Text>
            <Text style={styles.sheetText}>Сплошная синяя рамка · сегодня</Text>
          </View>
        </BottomSheet>
      )}
      {selectedDay && <AttendanceDayDetails day={selectedDay} onClose={() => { setOpenDate(undefined); onDayClosed?.(); }}
        onOpenPeriod={onOpenPeriod && selectedDay.absencePeriod && selectedDay.absencePeriod.to >= today ? () => {
          setOpenDate(undefined);
          onOpenPeriod(selectedDay);
        } : undefined} />}
    </>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  monthCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  info: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', color: c.actionPrimary },
  monthTitle: { flexShrink: 1, color: c.text, textAlign: 'center', fontSize: typeSize.navigationTitle, fontWeight: '700' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: c.textSecondary, fontSize: typeSize.caption },
  cell: { flex: 1, minWidth: 0 },
  day: {
    minHeight: controlHeight.touch, alignItems: 'center', flexGrow: 1, margin: 2,
    borderWidth: 2, borderColor: 'transparent', borderRadius: radius.control, paddingVertical: 2,
  },
  compactDay: { minHeight: 38, margin: 1, paddingVertical: 0 },
  inlineDay: { minHeight: 28, flexDirection: 'row', justifyContent: 'center', columnGap: 1 },
  dayNumber: { color: c.text, fontSize: typeSize.label, fontWeight: '600', lineHeight: 18, includeFontPadding: false },
  secondary: { color: c.textSecondary },
  visit: { backgroundColor: c.successSoft },
  absence: { backgroundColor: c.dangerSoft },
  planned: { backgroundColor: c.primarySoft, borderStyle: 'dashed', borderColor: c.actionPrimary },
  inactive: { backgroundColor: c.fill },
  plain: { backgroundColor: c.card },
  today: { borderColor: c.actionPrimary, borderStyle: 'solid' },
  pressed: { opacity: 0.8 },
  focused: { outlineColor: c.text, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 0 },
  symbol: { color: c.textSecondary, fontSize: typeSize.caption, fontWeight: '700', lineHeight: 16, includeFontPadding: false, marginTop: 1 },
  visitedSymbol: { color: c.success },
  plannedSymbol: { color: c.actionPrimary },
  paid: { color: c.danger },
  legendAction: { alignSelf: 'flex-start' },
  sheetContent: { gap: space.sm },
  sheetText: { color: c.text, fontSize: typeSize.label, lineHeight: space.xl },
}));
