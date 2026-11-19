import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AttendanceCalendar, AttendanceMonthHeader } from './attendance-calendar';
import { AttendanceOverview } from './attendance-overview';
import Avatar from './avatar';
import { ActionButton, StatusMessage } from './ui';
import { radius, space, typeSize } from '../constants/ui-tokens';
import { useAttendanceToday, useOwnAttendance } from '../hooks/use-own-attendance';
import { makeStyles, usePalette } from '../hooks/use-palette';
import type { AttendanceChild } from '../services/api/own-attendance';
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
  childId?: string;
  cursor: string | null;
  onCursorChange: (month: string) => void;
  selected?: Child;
  showIdentity?: boolean;
  onChooseChild?: () => void;
  onUnavailable?: () => void;
}

export function ChildAttendancePanel({
  childId, cursor, onCursorChange, selected, showIdentity, onChooseChild, onUnavailable,
}: PanelProps) {
  const styles = useStyles();
  const colors = usePalette();
  const narrow = useWindowDimensions().width < 380;
  const [revision, setRevision] = useState(0);
  const clock = useAttendanceToday(Boolean(childId), revision);
  const today = clock?.value;
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
    ? (selected ? `${selected.firstName} ${selected.surname}`.trim() : report?.name)
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
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, narrow && styles.narrowContent]}>
      {(displayName || report?.groups.length || onChooseChild) ? (
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

      <View style={[styles.panel, narrow && styles.narrowPanel]}>
        {month && (
          <View style={narrow && styles.panelInset}>
            <AttendanceMonthHeader label={month.label} canNext={Boolean(lastMonth && month.from < lastMonth)}
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
          <AttendanceCalendar key={childId} month={month} days={report.days} today={today} />
        ) : (
          <View style={styles.loading} accessibilityLabel="Загружаем посещения">
            <ActivityIndicator size="large" color={colors.actionPrimary} />
          </View>
        )}
      </View>
      {!failed && report && !outsideGroup && <AttendanceOverview summary={report.summary} />}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.section },
  narrowContent: { paddingHorizontal: space.xs },
  identity: { borderRadius: radius.card, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center',
    gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.lg },
  context: { paddingHorizontal: space.sm },
  identityText: { flex: 1, gap: space.xxs },
  name: { color: c.text, fontSize: typeSize.body, fontWeight: '700' },
  group: { color: c.textSecondary, fontSize: typeSize.caption },
  panel: { backgroundColor: c.card, borderRadius: radius.card, gap: space.sm, padding: space.md },
  narrowPanel: { paddingHorizontal: 0 },
  panelInset: { paddingHorizontal: space.md },
  status: { gap: space.sm, marginHorizontal: space.md, marginVertical: space.xxs },
  loading: { minHeight: 120, justifyContent: 'center', alignItems: 'center' },
}));
