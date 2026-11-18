import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import OptionSheet, { SheetOption } from '../../../components/option-sheet';
import { ActionButton, BottomSheet, FormField, StatusMessage } from '../../../components/ui';
import { IconSymbol } from '../../../components/ui/icon-symbol';
import { RefreshControl } from '../../../components/ui/refresh-control';
import { LoadState, useVisitListStyles } from '../../../components/visit-list';
import { controlHeight, radius, space, typeSize } from '../../../constants/ui-tokens';
import { makeStyles, usePalette } from '../../../hooks/use-palette';
import { AbsenceDay, AbsenceDayRow, getAbsenceDay, getNeighboringAbsenceDay } from '../../../services/api/absence-day';
import { ApiError } from '../../../services/errors/api-error';
import { formatDate, parseDate } from '../../../utils/input-masks';
import { plural } from '../../../utils/plural';
import { formatBirthDate } from '../../../utils/profile-format';

type Request = { type: 'date'; date?: string } | { type: 'neighbor'; date: string; direction: -1 | 1 };
type Section = { key: string; branch: string; title: string; data: AbsenceDayRow[] };
type Filter = 'branch' | 'group';

function countLabel(absent: number, total: number | null): string {
  return total !== null && total >= absent ? `${absent} из ${total}` : String(absent);
}

function sectionsFor(day: AbsenceDay, branchId: string | null, groupId: string | null, lateOnly: boolean): Section[] {
  return day.branches
    .filter((branch) => !branchId || branchId === branch.id)
    .flatMap((branch) => branch.groups
      .filter((group) => !groupId || groupId === group.id)
      .map((group) => {
        const data = group.absences
          .filter((row) => !lateOnly || row.late)
          .sort((first, second) => first.childName.localeCompare(second.childName, 'ru'));
        return {
          key: group.id,
          branch: day.branches.length > 1 ? branch.name : '',
          title: `${group.name} · не будет ${countLabel(data.length, group.totalChildren)}`,
          data,
        };
      }))
    .filter((section) => !lateOnly || section.data.length > 0);
}

export default function AbsencesScreen() {
  const c = usePalette();
  const styles = useStyles();
  const listStyles = useVisitListStyles();
  const [report, setReport] = useState<AbsenceDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [draftDate, setDraftDate] = useState('');
  const [dateError, setDateError] = useState<string | undefined>();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [lateOnly, setLateOnly] = useState(false);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [details, setDetails] = useState<{ row: AbsenceDayRow; date: string } | null>(null);
  const active = useRef<AbortController | null>(null);
  const selected = useRef<string | undefined>(undefined);
  const lastRequest = useRef<Request>({ type: 'date' });

  const load = useCallback(async (request: Request) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    lastRequest.current = request;
    setError(undefined);
    setDetails(null);
    setLoading(true);
    try {
      const next = request.type === 'date'
        ? await getAbsenceDay(request.date, controller.signal)
        : await getNeighboringAbsenceDay(request.date, request.direction, controller.signal);
      if (controller.signal.aborted) return;
      selected.current = request.type === 'date' ? request.date : next.date;
      setReport(next);
      setDraftDate(formatBirthDate(next.date) ?? '');
      setDateError(undefined);
      if (!next.deadline) setLateOnly(false);
      if (request.type === 'neighbor' || request.date) {
        setBranchId((id) => next.branches.some((branch) => branch.id === id) ? id : null);
        setGroupId((id) => next.branches.some((branch) => branch.groups.some((group) => group.id === id)) ? id : null);
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
          setReport(null);
          setDetails(null);
          setError('У вас нет доступа к списку отсутствующих');
        } else {
          setError('Не удалось загрузить список отсутствующих');
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        active.current = null;
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load({ type: 'date', date: selected.current });
    return () => active.current?.abort();
  }, [load]));

  const sections = useMemo(() => report?.working
    ? sectionsFor(report, branchId, groupId, lateOnly)
    : [], [report, branchId, groupId, lateOnly]);
  const branches = report?.branches ?? [];
  const groups = branches.filter((branch) => !branchId || branch.id === branchId).flatMap((branch) => branch.groups);
  const branch = branches.find((item) => item.id === branchId);
  const group = groups.find((item) => item.id === groupId);
  const scope = group ? [group] : groups;
  // У группы «Без группы» сервер может не знать численность, а общий итог может её исключать.
  const unavailableTotal = scope.some((item) => item.totalChildren == null && item.absences.length > 0);
  const totals = !branch && !group
    ? { children: report?.totalChildren ?? null, absent: report?.absentChildren ?? 0, late: report?.lateChildren ?? 0 }
    : scope.reduce((sum, item) => ({
      children: sum.children + (item.totalChildren ?? 0),
      absent: sum.absent + item.absences.length,
      late: sum.late + item.absences.filter((row) => row.late).length,
    }), { children: 0, absent: 0, late: 0 });

  function applyDate() {
    const parsed = parseDate(draftDate);
    if (!parsed) {
      setDateError('Введите дату в формате ДД.ММ.ГГГГ');
      return;
    }
    void load({ type: 'date', date: parsed.iso });
  }

  function changeBranch(id: string | null) {
    setBranchId(id);
    setGroupId(null);
  }

  const options: SheetOption[] = filter === 'branch'
    ? [
      { key: 'all-branches', label: 'Все филиалы', selected: !branchId, onPress: () => changeBranch(null) },
      ...branches.map((item) => ({
        key: item.id, label: item.name, selected: item.id === branchId, onPress: () => changeBranch(item.id),
      })),
    ]
    : [
      { key: 'all-groups', label: 'Все группы', selected: !groupId, onPress: () => setGroupId(null) },
      ...groups.map((item) => ({
        key: item.id, label: item.name, selected: item.id === groupId, onPress: () => setGroupId(item.id),
      })),
    ];

  if (!report && loading) return <View style={styles.screen}><LoadState status="loading" onRetry={() => {}} /></View>;

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={listStyles.listContainer}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load({ type: 'date', date: selected.current })} />}
        ListHeaderComponent={
          <View>
            {report ? (
              <>
                <View style={styles.dayBar}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Предыдущий рабочий день"
                    disabled={loading}
                    onPress={() => void load({ type: 'neighbor', date: report.date, direction: -1 })}
                    style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
                  >
                    <IconSymbol name="chevron.right" size={20} style={styles.arrowBack} color={loading ? c.textTertiary : c.actionPrimary} />
                  </Pressable>
                  <Text accessibilityRole="header" style={styles.heading}>{formatBirthDate(report.date)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Следующий рабочий день"
                    disabled={loading}
                    onPress={() => void load({ type: 'neighbor', date: report.date, direction: 1 })}
                    style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
                  >
                    <IconSymbol name="chevron.right" size={20} color={loading ? c.textTertiary : c.actionPrimary} />
                  </Pressable>
                </View>
                <View style={styles.dateForm}>
                  <View style={styles.dateInput}>
                    <FormField
                      label="Дата"
                      placeholder="ДД.ММ.ГГГГ"
                      keyboardType="numeric"
                      value={draftDate}
                      onChangeText={(value) => { setDraftDate(formatDate(value)); setDateError(undefined); }}
                      onSubmitEditing={applyDate}
                      error={dateError}
                      returnKeyType="go"
                      editable={!loading}
                    />
                  </View>
                  <View style={styles.dateAction}>
                    <ActionButton label="Показать" variant="text" onPress={applyDate} disabled={loading} />
                  </View>
                </View>
                {report.working && (
                  <>
                    <Text style={listStyles.total}>Не придут {countLabel(totals.absent, unavailableTotal ? null : totals.children)}</Text>
                    {report.deadline ? <Text style={styles.secondary}>Срок {report.deadline}. После срока — {totals.late}</Text> : null}
                    {branches.length > 1 || groups.length > 1 || report.deadline ? (
                      <View style={styles.filters}>
                        {branches.length > 1 && (
                          <ActionButton label={branch?.name ?? 'Все филиалы'} variant="text" onPress={() => setFilter('branch')} />
                        )}
                        {groups.length > 1 && (
                          <ActionButton label={group?.name ?? 'Все группы'} variant="text" onPress={() => setFilter('group')} />
                        )}
                        {report.deadline && (
                          <ActionButton
                            label={lateOnly ? 'После срока · включено' : 'Только после срока'}
                            variant="text"
                            onPress={() => setLateOnly((value) => !value)}
                          />
                        )}
                      </View>
                    ) : null}
                  </>
                )}
              </>
            ) : null}
            {error ? (
              <>
                <StatusMessage message={error} tone="error" />
                <ActionButton label="Повторить" variant="text" onPress={() => void load(lastRequest.current)} />
              </>
            ) : null}
            {report && !report.working ? <StatusMessage message="Сад в этот день не работает" /> : null}
            {report?.working && !error && totals.absent === 0 && !lateOnly ? (
              <StatusMessage message="Пока никто не предупредил" />
            ) : null}
            {report?.working && !error && lateOnly && sections.length === 0 ? (
              <StatusMessage message="Нет сообщений после срока" />
            ) : null}
            {report?.working && !error && lateOnly && sections.length > 0 ? (
              <StatusMessage message="Показаны сообщения после срока. Оплата указана для каждого ребёнка." />
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.section}>
            {section.branch ? <Text style={styles.secondary}>{section.branch}</Text> : null}
            <Text accessibilityRole="header" style={listStyles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Подробнее об отсутствии: ${item.childName}`}
            onPress={() => report && setDetails({ row: item, date: report.date })}
            style={({ pressed }) => [
              listStyles.row,
              index === 0 && listStyles.rowFirst,
              index === section.data.length - 1 && listStyles.rowLast,
              pressed && styles.rowPressed,
            ]}
          >
            <AbsenceRow row={item} date={report?.date} />
            <IconSymbol name="chevron.right" size={20} color={c.textSecondary} />
          </Pressable>
        )}
      />
      <OptionSheet
        visible={Boolean(filter)}
        title={filter === 'branch' ? 'Филиал' : 'Группа'}
        sections={[{ key: 'filters', title: '', data: options }]}
        onClose={() => setFilter(null)}
      />
      {details && (
        <AbsenceDetails row={details.row} date={details.date} onClose={() => setDetails(null)} />
      )}
    </View>
  );
}

function AbsenceRow({ row, date, detailed = false }: { row: AbsenceDayRow; date?: string; detailed?: boolean }) {
  const styles = useStyles();
  const listStyles = useVisitListStyles();
  const from = formatBirthDate(row.from);
  const to = formatBirthDate(row.to);
  const days = row.remainingDays;
  return (
    <View style={detailed ? styles.detailsBody : styles.rowBody}>
      <View style={styles.rowBody}>
        <Text accessibilityRole={detailed ? 'header' : undefined} style={[listStyles.rowTitle, styles.rowName]}>
          {row.childName}
        </Text>
        <Text style={styles.secondary}>{row.from === row.to ? from : `${from} — ${to}`}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={detailed ? styles.comment : styles.secondary}>
          {row.reason}
          {days !== null && days > 0 ? ` · ещё ${days} ${plural(days, ['рабочий день', 'рабочих дня', 'рабочих дней'])}` : ''}
        </Text>
        {detailed && row.comment ? <Text style={styles.comment}>«{row.comment}»</Text> : null}
      </View>
      {detailed && (row.author || row.created) ? (
        <Text style={styles.secondary}>
          {row.author ? `Сообщил(а) ${row.author}` : 'Сообщение получено'}
          {row.created ? ` · ${row.created}` : ''}
        </Text>
      ) : null}
      {row.late ? (
        <Text style={row.charged ? styles.charged : styles.secondary}>
          {formatBirthDate(date ?? null)} · сообщили после срока{row.charged ? ' · день оплачивается' : ' · оплата снята'}
        </Text>
      ) : null}
    </View>
  );
}

function AbsenceDetails({ row, date, onClose }: { row: AbsenceDayRow; date: string; onClose: () => void }) {
  return (
    <BottomSheet title="Сообщение об отсутствии" onClose={onClose}>
      <AbsenceRow row={row} date={date} detailed />
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  dayBar: {
    borderRadius: radius.card,
    backgroundColor: c.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  arrow: { width: controlHeight.touch, minHeight: controlHeight.touch, alignItems: 'center', justifyContent: 'center' },
  arrowBack: { transform: [{ rotate: '180deg' }] },
  arrowPressed: { backgroundColor: c.primarySoft, borderRadius: radius.control },
  heading: { color: c.text, fontSize: typeSize.body, fontWeight: '700', paddingVertical: space.sm },
  dateForm: { flexDirection: 'row', gap: space.sm },
  dateInput: { flex: 1 },
  dateAction: { marginTop: space.xxl },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  section: { marginTop: space.sm },
  rowBody: { flex: 1, minWidth: 0, gap: space.xxs },
  rowPressed: { backgroundColor: c.primarySoft },
  rowName: { fontWeight: '600' },
  comment: { color: c.text, fontSize: typeSize.label },
  secondary: { color: c.textSecondary, fontSize: typeSize.caption },
  charged: { color: c.danger, fontSize: typeSize.caption, fontWeight: '600' },
  detailsBody: { gap: space.md },
}));
