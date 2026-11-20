import { useFocusEffect } from '@react-navigation/native';
import { CalendarAbsenceEntry } from './calendar-absence-entry';
import { CalendarAbsenceList } from './calendar-absence-list';
import { getAbsenceRules, type AbsenceRules } from '../services/api/absence';
import { ApiError } from '../services/errors/api-error';
import { personName } from '@/utils/people-format';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AttendanceCalendar, AttendanceMonthHeader } from './attendance-calendar';
import { AttendanceOverview } from './attendance-overview';
import Avatar from './avatar';
import { ActionButton, StatusMessage } from './ui';
import { radius, space, typeSize } from '../constants/ui-tokens';
import { useAttendanceToday, useOwnAttendance } from '../hooks/use-own-attendance';
import { makeStyles, usePalette } from '../hooks/use-palette';
import type { AttendanceChild, AttendanceDay } from '../services/api/own-attendance';
import type { Child } from '../store/types/children';
import { calendarMonth, shiftCalendarMonth } from '../utils/calendar-month';
import { formatBirthDate } from '../utils/profile-format';

function groupLabel(group: AttendanceChild['groups'][number], transferred: boolean): string {
  const name = group.branch ? `${group.name} · ${group.branch}` : group.name;
  if (!transferred) return name;
  const from = formatBirthDate(group.from);
  const to = formatBirthDate(group.to);
  return `${name} · ${to ? `${from} — ${to}` : `с ${from}`}`;
}

interface PanelProps {
  renderChildPicker?: (context?: string) => ReactNode;
  childId?: string;
  cursor: string | null;
  onCursorChange: (month: string) => void;
  selected?: Child;
  showIdentity?: boolean;
  embedded?: boolean;
  onChooseChild?: () => void;
  onListVisibility?: (open: boolean) => void;
  onUnavailable?: () => void;
}

export function ChildAttendancePanel({
  childId, cursor, onCursorChange, selected, showIdentity, renderChildPicker, embedded = false, onChooseChild, onUnavailable, onListVisibility,
}: PanelProps) {
  const styles = useStyles();
  const colors = usePalette();
  const { width, height } = useWindowDimensions();
  const narrow = width < 380;
  const short = embedded && height < 680;
  const [restoredDay, setRestoredDay] = useState<string>();
  const [legend, setLegend] = useState(false);
  const [absence, setAbsence] = useState<AbsenceRules>();
  const [absenceFailed, setAbsenceFailed] = useState(false);
  const [list, setList] = useState<{ day?: AttendanceDay }>();
  const listVisible = Boolean(embedded && list && selected && absence);
  useLayoutEffect(() => {
    onListVisibility?.(listVisible);
    return () => onListVisibility?.(false);
  }, [listVisible, onListVisibility]);
  const backToMonth = useCallback(() => { setRestoredDay(list?.day?.date); setList(undefined); }, [list]);
  const [revision, setRevision] = useState(0);
  const clock = useAttendanceToday(Boolean(childId), revision);
  const today = clock?.value;
  useFocusEffect(useCallback(() => {
    if (!childId || !embedded) return;
    let controller: AbortController | undefined;
    function refresh(id: string) {
      controller?.abort();
      const next = new AbortController();
      controller = next;
      getAbsenceRules(id, next.signal).then(value => {
        if (!next.signal.aborted) { setAbsence(value); setAbsenceFailed(false); }
      }).catch(error => {
        if (next.signal.aborted) return;
        const denied = error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0);
        if (denied) { setAbsence(undefined); setList(undefined); }
        setAbsenceFailed(!denied);
      });
    }
    refresh(childId);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(childId); });
    return () => { controller?.abort(); subscription.remove(); };
  }, [childId, embedded, revision, today]));
  const lastMonth = today && shiftCalendarMonth(today, 1);
  const date = cursor && lastMonth && cursor <= lastMonth ? cursor : today;
  const month = date ? calendarMonth(date) : null;
  const result = useOwnAttendance(month?.from, month?.to, { child: childId, today, revision });
  const report = result?.value?.[0];
  const status = result?.failed?.status;
  const unavailable = !childId || status === 403 || status === 404 || result?.value?.length === 0;
  const failed = Boolean(clock?.failed || result?.failed);
  const outsideGroup = report?.groups.length === 0 && report.days.every((day) => day.status === 'NOT_IN_GROUP');

  useEffect(() => {
    if (unavailable) onUnavailable?.();
  }, [unavailable, onUnavailable]);

  const displayName = showIdentity
    ? (selected ? personName(selected) : report?.name)
    : undefined;
  function retry() {
    setRevision((value) => value + 1);
  }

  if (unavailable) {
    if (onUnavailable) return null;
    return (
      <View style={styles.status}>
        <StatusMessage message="Посещения этого ребёнка недоступны" />
        <ActionButton label="Повторить" variant="text" onPress={retry} />
      </View>
    );
  }
  if (embedded && list && selected && absence) {
    return <CalendarAbsenceList child={selected} rules={absence} day={list.day} onBack={backToMonth} onRefresh={retry}
      onReturnToDay={backToMonth} />;
  }
  const context = [displayName, ...(report?.groups.map(group => groupLabel(group, report.groups.length > 1)) ?? [])].filter(Boolean).join(' · ');
  return <View style={styles.screen}>
    {renderChildPicker?.(short ? context : undefined)}
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, short && styles.shortContent]}>
      {embedded && context && !(short && renderChildPicker) ? (
        <Text style={[styles.context, styles.group]}>{context}</Text>
      ) : null}
      {!embedded && (displayName || report?.groups.length || onChooseChild) ? (
        <View style={showIdentity ? styles.identity : styles.context}>
          {displayName && selected && <Avatar firstName={selected.firstName} surname={selected.surname} photoUrl={selected.photoUrl} size={40} />}
          <View style={styles.identityText}>
            {displayName ? <Text style={styles.name} accessibilityRole="header">{displayName}</Text> : null}
            {report?.groups.map((group, index) => (
              <Text key={`${group.from}:${index}`} style={styles.group}>
                {groupLabel(group, report.groups.length > 1)}
              </Text>
            ))}
          </View>
          {onChooseChild && (
            <ActionButton label="⌄" variant="text" accessibilityLabel="Выбрать ребёнка" onPress={onChooseChild} />
          )}
        </View>
      ) : null}

      {embedded && absenceFailed ? <View style={styles.panel}><StatusMessage message="Не удалось загрузить отсутствия" tone="error" />
        <ActionButton label="Повторить" variant="text" onPress={retry} /></View> : embedded && absence && selected &&
        <CalendarAbsenceEntry rules={absence} onPress={() => setList({})} />}
      <View style={[styles.panel, narrow && styles.narrowPanel]}>
        {month && (
          <View style={narrow && styles.panelInset}>
            <AttendanceMonthHeader label={month.label} canNext={Boolean(lastMonth && month.from < lastMonth)}
              onLegend={embedded && report && !failed && !outsideGroup ? () => setLegend(true) : undefined}
              onPrevious={() => onCursorChange(shiftCalendarMonth(month.from, -1))}
              onNext={() => onCursorChange(shiftCalendarMonth(month.from, 1))} />
          </View>
        )}
        {failed ? (
          <View style={styles.status}>
            <StatusMessage message="Не удалось загрузить посещения" tone="error" />
            <ActionButton variant="text" label="Повторить" onPress={retry} />
          </View>
        ) : outsideGroup ? (
          <View style={styles.status}>
            <StatusMessage message="В этом месяце ребёнок не состоял в группе" />
          </View>
        ) : month && today && report ? (
          <AttendanceCalendar key={childId} month={month} days={report.days} today={today}
            initialOpenDate={restoredDay} onDayClosed={() => setRestoredDay(undefined)} compact={embedded && height < 720} inlineMarks={short}
            showLegend={embedded ? legend : undefined} onCloseLegend={embedded ? () => setLegend(false) : undefined}
            onOpenPeriod={embedded && absence && selected ? day => setList({ day }) : undefined} />
        ) : (
          <View style={styles.loading} accessibilityLabel="Загружаем посещения">
            <ActivityIndicator size="large" color={colors.actionPrimary} />
          </View>
        )}
      </View>
      {!failed && report && !outsideGroup && <AttendanceOverview compact={short} summary={report.summary} />}
    </ScrollView>
  </View>;
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: space.sm,
    paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm },
  shortContent: { gap: space.xxs, paddingVertical: space.xxs },
  identity: { borderRadius: radius.card, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center',
    gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.lg },
  context: { paddingHorizontal: space.sm },
  identityText: { flex: 1, gap: space.xxs },
  name: { color: c.text, fontSize: typeSize.body, fontWeight: '700' },
  group: { color: c.textSecondary, fontSize: typeSize.caption },
  panel: { backgroundColor: c.card, borderRadius: radius.card, gap: space.xxs, padding: space.xs },
  narrowPanel: { paddingHorizontal: 0 },
  panelInset: { paddingHorizontal: space.md },
  status: { gap: space.sm, marginHorizontal: space.md, marginVertical: space.xxs },
  loading: { minHeight: 120, justifyContent: 'center', alignItems: 'center' },
}));
