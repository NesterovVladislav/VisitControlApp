import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import AbsenceCalendar from '../../../components/absence-calendar';
import { periodLabel } from '../../../components/calendar-absence-entry';
import OptionSheet, { SheetSection } from '../../../components/option-sheet';
import { ActionButton, BottomSheet, FormField, StatusMessage } from '../../../components/ui';
import { RefreshControl } from '../../../components/ui/refresh-control';
import { LoadState } from '../../../components/visit-list';
import { controlHeight, radius, space, typeSize } from '../../../constants/ui-tokens';
import { makeStyles, usePalette } from '../../../hooks/use-palette';
import { AbsenceDay, AbsenceDayRow, getAbsenceDay, getNeighboringAbsenceDay } from '../../../services/api/absence-day';
import { ApiError } from '../../../services/errors/api-error';
import { absenceDateLabel, absentChildrenLabel } from '../../../utils/absence-day-labels';
import { formatDate, parseDate } from '../../../utils/input-masks';
import { plural } from '../../../utils/plural';
import { formatBirthDate } from '../../../utils/profile-format';

type Request = { type: 'date'; date?: string } | { type: 'neighbor'; date: string; direction: -1 | 1 };
type Scope = { groupId?: string; branchId?: string; name: string };
const allGroups: Scope = { name: 'Все группы' };

function scopeOptions(report: AbsenceDay, scope: Scope, select: (value: Scope) => void): SheetSection[] {
  return [
    { key: 'all', title: '', data: [{ key: 'all', label: allGroups.name,
      selected: !scope.groupId && !scope.branchId, onPress: () => select(allGroups) }] },
    ...report.branches.map(branch => ({
      key: branch.id, title: report.branches.length > 1 ? branch.name : '',
      data: [
        ...(report.branches.length > 1 ? [{ key: 'branch-' + branch.id, label: 'Все группы филиала',
          selected: scope.branchId === branch.id, onPress: () => select({ branchId: branch.id, name: branch.name }) }] : []),
        ...branch.groups.map(group => ({ key: group.id, label: group.name, selected: scope.groupId === group.id,
          onPress: () => select({ groupId: group.id, name: group.name }) })),
      ],
    })),
  ];
}

export default function AbsencesScreen() {
  const c = usePalette();
  const s = useStyles();
  const params = useLocalSearchParams<{ groupId?: string; groupName?: string; date?: string }>();
  const [scope, setScope] = useState<Scope>(() => params.groupId ? { groupId: params.groupId, name: params.groupName || 'Выбранная группа' } : allGroups);
  const [report, setReport] = useState<AbsenceDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [lateOnly, setLateOnly] = useState(false);
  const [sheet, setSheet] = useState<'scope' | 'time' | 'date' | null>(null);
  const [details, setDetails] = useState<AbsenceDayRow | null>(null);
  const active = useRef<AbortController | null>(null);
  const selected = useRef(params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined);
  const lastRequest = useRef<Request>({ type: 'date', date: selected.current });

  const load = useCallback(async (request: Request) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    lastRequest.current = request;
    setDetails(null);
    setSheet(null);
    setError(undefined);
    setLoading(true);
    try {
      const next = request.type === 'date' ? await getAbsenceDay(request.date, controller.signal)
        : await getNeighboringAbsenceDay(request.date, request.direction, controller.signal);
      if (controller.signal.aborted) return;
      selected.current = request.type === 'date' ? request.date : next.date;
      setReport(next);
      if (!next.deadline) setLateOnly(false);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        setReport(null);
        setError('У вас нет доступа к списку отсутствующих');
      } else {
        setError('Не удалось загрузить список отсутствующих');
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

  const sections = useMemo(() => report?.working ? report.branches
    .filter(branch => !scope.branchId || scope.branchId === branch.id)
    .flatMap(branch => branch.groups.filter(group => !scope.groupId || group.id === scope.groupId)
      .map(group => ({
        key: group.id, name: group.name, branch: branch.name, total: group.totalChildren,
        absent: group.absences.length, late: group.absences.filter(row => row.late).length,
        data: group.absences.filter(row => !lateOnly || row.late).sort((a, b) => a.childName.localeCompare(b.childName, 'ru')),
      }))) : [], [report, scope, lateOnly]);
  const completeScope = !scope.groupId && !scope.branchId;
  const absent = completeScope ? report?.absentChildren ?? 0 : sections.reduce((total, section) => total + section.absent, 0);
  const late = completeScope ? report?.lateChildren ?? 0 : sections.reduce((total, section) => total + section.late, 0);
  const options = report ? scopeOptions(report, scope, setScope) : [];
  const canSelectScope = !!report && (!completeScope || report.branches.length > 1 || report.branches.some(b => b.groups.length > 1));
  const chosen = sections[0];
  const duplicateName = scope.groupId && chosen && report?.branches.some(branch =>
    branch.groups.some(group => group.id !== chosen.key && group.name === chosen.name));
  const scopeName = scope.groupId && chosen ? [chosen.name, duplicateName && chosen.branch].filter(Boolean).join(' · ') : scope.name;
  const missingScope = !!report?.working && !completeScope && sections.length === 0;
  const summary = absentChildrenLabel(absent);
  const empty = report?.working && !missingScope && !loading && !error && (lateOnly ? late === 0 : absent === 0);
  const hasLateFilter = !!report?.deadline && (late > 0 || lateOnly);
  const dayLabel = report ? absenceDateLabel(report.date, true) : '';

  if (!report && loading) return <View style={s.screen}><LoadState status="loading" onRetry={() => {}} /></View>;
  return <View style={s.screen}>
    <SectionList
      sections={sections.filter(section => section.data.length > 0)}
      keyExtractor={row => row.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load({ type: 'date', date: selected.current })} />}
      ListHeaderComponent={<View style={s.controls}>
        {report && <>
          <View style={s.dayBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Предыдущий рабочий день" disabled={loading}
              style={s.arrow} onPress={() => void load({ type: 'neighbor', date: report.date, direction: -1 })}>
              <Ionicons name="chevron-back" size={19} color={loading ? c.disabled : c.actionPrimary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Выбрать дату. ${dayLabel}`} disabled={loading}
              style={s.dateControl} onPress={() => setSheet('date')}>
              <Ionicons name="calendar-outline" size={18} color={c.actionPrimary} />
              <Text style={[s.headline, s.dateTitle]}>{dayLabel}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Следующий рабочий день" disabled={loading}
              style={s.arrow} onPress={() => void load({ type: 'neighbor', date: report.date, direction: 1 })}>
              <Ionicons name="chevron-forward" size={19} color={loading ? c.disabled : c.actionPrimary} />
            </Pressable>
          </View>
          {(canSelectScope || hasLateFilter) && <View style={s.filters}>
            {canSelectScope && <Pressable accessibilityRole="button" accessibilityLabel={`Группы. ${scopeName}`}
              onPress={() => setSheet('scope')} style={s.scope}>
              <Ionicons name="people-outline" size={20} color={c.textSecondary} />
              <Text style={[s.headline, s.fill]}>{scopeName}</Text>
              <Ionicons name="chevron-down" size={16} color={c.textSecondary} />
            </Pressable>}
            {hasLateFilter && <Pressable accessibilityRole="button" accessibilityLabel="Фильтр по времени сообщения"
              accessibilityState={{ selected: lateOnly }} onPress={() => setSheet('time')} style={[s.arrow, s.filterButton, lateOnly && s.active]}>
              <Ionicons name="filter-outline" size={19} color={lateOnly ? c.actionPrimary : c.textSecondary} />
            </Pressable>}
          </View>}
          {report.working && absent > 0 && <Text style={s.summary}>
            {lateOnly ? `Сообщили позже · ${late} из ${absent}` : summary.charAt(0).toUpperCase() + summary.slice(1)}
          </Text>}
          {!report.working && <StatusMessage message="Сад в этот день не работает" />}
          {missingScope && !loading && !error && <StatusMessage message={scope.groupId
            ? 'На эту дату нет данных по выбранной группе' : 'На эту дату нет данных по выбранному филиалу'} />}
          {empty && <View style={s.empty}>
            <Text style={s.secondary}>{lateOnly ? 'Все предупредили вовремя' : 'На эту дату сообщений нет'}</Text>
            <ActionButton variant="text" label={lateOnly ? 'Показать все сообщения' : 'Выбрать дату'}
              onPress={() => lateOnly ? setLateOnly(false) : setSheet('date')} />
          </View>}
        </>}
        {error && <><StatusMessage message={error} tone="error" />
          <ActionButton label="Повторить" variant="text" onPress={() => void load(lastRequest.current)} /></>}
      </View>}
      renderSectionHeader={({ section }) => scope.groupId ? null : <View style={s.groupHead}>
        <View style={s.fill}>
          {!scope.branchId && (report?.branches.length ?? 0) > 1 && <Text style={s.secondary}>{section.branch}</Text>}
          <Text accessibilityRole="header" style={s.headline}>{section.name}</Text>
        </View>
        <Text style={s.secondary}>{section.total != null && section.total >= section.data.length
          ? `${section.data.length} из ${section.total}` : section.data.length}</Text>
      </View>}
      renderItem={({ item, section, index }) => <Pressable accessibilityRole="button"
        accessibilityLabel={`Подробнее об отсутствии: ${item.childName}`} onPress={() => setDetails(item)}
        style={({ pressed }) => [s.row, scope.groupId && index === 0 && s.first, index === section.data.length - 1 && s.last, pressed && s.active]}>
        <View style={s.fill}>
          <Text style={s.headline}>{item.childName}</Text>
          <Text style={s.secondary}>{item.reason} · {periodLabel(item.from, item.to, report!.date)}</Text>
          {item.late && <View style={s.late}><Ionicons name="time-outline" size={14} color={c.textSecondary} />
            <Text style={s.caption}>Сообщили позже</Text></View>}
        </View>
        <Ionicons name="chevron-forward" size={17} color={c.textSecondary} />
      </Pressable>}
    />
    <OptionSheet visible={sheet === 'scope' || sheet === 'time'} title={sheet === 'time' ? 'Время сообщения' : 'Группы'} onClose={() => setSheet(null)}
      sections={[
        ...(sheet === 'scope' ? options : []),
        ...(sheet === 'time' ? [{ key: 'time', title: '', data: [
          { key: 'all-messages', label: 'Все сообщения', selected: !lateOnly, onPress: () => setLateOnly(false) },
          { key: 'late', label: 'Сообщили позже', selected: lateOnly, onPress: () => setLateOnly(true) },
        ] }] : []),
      ]} />
    {sheet === 'date' && report && <DateSheet date={report.date} close={() => setSheet(null)}
      choose={date => void load({ type: 'date', date })} />}
    {details && report && <AbsenceDetails row={details} report={report} close={() => setDetails(null)} />}
  </View>;
}

function DateSheet({ date, close, choose }: { date: string; close: () => void; choose: (iso: string) => void }) {
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState(formatBirthDate(date) ?? '');
  const [error, setError] = useState<string>();
  const apply = () => {
    const parsed = parseDate(draft);
    if (parsed) choose(parsed.iso);
    else setError('Введите дату в формате ДД.ММ.ГГГГ');
  };
  return <BottomSheet title="Выбрать дату" onClose={close}>
    {manual ? <>
      <FormField label="Дата" placeholder="ДД.ММ.ГГГГ" keyboardType="numeric" value={draft}
        onChangeText={value => { setDraft(formatDate(value)); setError(undefined); }}
        onSubmitEditing={apply} returnKeyType="go" error={error} />
      <ActionButton label="Показать" onPress={apply} />
    </> : <AbsenceCalendar selected={date} min="0100-01-01" max="9999-12-31" onChoose={choose} />}
    <ActionButton label={manual ? 'Выбрать в календаре' : 'Ввести дату'} variant="text" onPress={() => setManual(!manual)} />
  </BottomSheet>;
}

function AbsenceDetails({ row, report, close }: { row: AbsenceDayRow; report: AbsenceDay; close: () => void }) {
  const s = useStyles();
  const meta = [
    { label: 'Предупредить до', value: report.deadline },
    { label: 'Сообщение получено', value: row.created },
    { label: `Оплата за ${absenceDateLabel(report.date)}`, value: row.late ? (row.charged ? 'Начислена' : 'Снята') : null },
  ].filter(item => item.value);
  return <BottomSheet title="Отсутствие" onClose={close}>
    <View style={s.fill}>
      <Text accessibilityRole="header" style={s.headline}>{row.childName}</Text>
      <Text style={s.secondary}>{row.reason} · {periodLabel(row.from, row.to, report.date)}</Text>
      {row.remainingDays != null && row.remainingDays > 0 && <Text style={s.secondary}>
        Ещё {row.remainingDays} {plural(row.remainingDays, ['рабочий день', 'рабочих дня', 'рабочих дней'])}
      </Text>}
    </View>
    {(row.comment || row.author) && <View style={s.fill}>
      {row.comment && <Text style={s.text}>«{row.comment}»</Text>}
      {row.author && <Text style={s.secondary}>{row.author}</Text>}
    </View>}
    {meta.length > 0 && <View>{meta.map(item => <View key={item.label} style={s.meta}>
      <Text style={s.metaLabel}>{item.label}</Text><Text style={s.metaValue}>{item.value}</Text>
    </View>)}</View>}
  </BottomSheet>;
}

const useStyles = makeStyles(c => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { alignSelf: 'center', width: '100%', maxWidth: 480, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl },
  controls: { gap: space.sm, marginBottom: space.sm },
  dayBar: { alignSelf: 'center', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', borderRadius: radius.card, backgroundColor: c.card },
  arrow: { width: controlHeight.touch, minHeight: controlHeight.touch, justifyContent: 'center', alignItems: 'center' },
  dateControl: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, minHeight: controlHeight.touch },
  dateTitle: { flexShrink: 1, textAlign: 'center' },
  filters: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  scope: { flex: 1, borderRadius: radius.card, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: space.md,
    minHeight: controlHeight.field, paddingHorizontal: space.lg, paddingVertical: space.sm },
  filterButton: { borderRadius: radius.control, backgroundColor: c.card, marginLeft: 'auto' },
  active: { backgroundColor: c.primarySoft },
  empty: { paddingVertical: space.xxl, alignItems: 'center', gap: space.sm },
  summary: { color: c.text, fontSize: typeSize.body, paddingHorizontal: space.xxs, marginTop: space.xs },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, backgroundColor: c.card,
    paddingHorizontal: space.lg, paddingVertical: space.md, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.lg, backgroundColor: c.card,
    minHeight: controlHeight.action, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  first: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  last: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, marginBottom: space.md, borderBottomWidth: 0 },
  fill: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: space.xxs },
  headline: { color: c.text, fontSize: typeSize.body, fontWeight: '600' },
  text: { color: c.text, fontSize: typeSize.body },
  secondary: { color: c.textSecondary, fontSize: typeSize.label },
  late: { flexDirection: 'row', gap: space.xxs, alignItems: 'center' },
  caption: { color: c.textSecondary, fontSize: typeSize.caption },
  meta: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.separator, paddingVertical: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  metaLabel: { flex: 1, color: c.textSecondary, fontSize: typeSize.label },
  metaValue: { flexShrink: 1, maxWidth: '55%', textAlign: 'right', color: c.text, fontSize: typeSize.label },
}));
