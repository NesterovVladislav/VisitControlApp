import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { space } from '../../../constants/ui-tokens';
import { AbsenceDayEntry, useAbsenceDayEntry } from '../../../components/absence-day-entry';
import { RefreshControl } from '../../../components/ui/refresh-control';
import SegmentedControl from '../../../components/segmented-control';
import { IconSymbol } from '../../../components/ui/icon-symbol';
import { LoadState, PresenceSections, useVisitListStyles } from '../../../components/visit-list';
import VisitQueue from '../../../components/visit-queue';
import { useOpenGroupMembers } from '../../../hooks/use-open-group-members';
import { useAppDispatch, useAppSelector } from '../../../store';
import { loadQueueStart, openQueue } from '../../../store/reducers/visit-queue';
import { loadJournalStart, loadPresentStart } from '../../../store/reducers/visits';
import { plural } from '../../../utils/plural';
import { BranchSummary, branchSections, branchSummaries, singleBranchId } from '../../../utils/presence';
import JournalList from '../../../components/staff-journal';
import StaffPresenceList from '../../../components/staff-presence-list';
import { StaffGroupSelect, staffGroups } from '../../../components/staff-group-select';
import type { StaffGroup } from '../../../components/staff-group-select';
import { makeStyles, usePalette } from '../../../hooks/use-palette';

type Mode = 'queue' | 'present' | 'journal';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'present', label: 'Кто в саду' },
  { value: 'journal', label: 'Журнал' },
];

/**
 * Вкладка «Посещение»: кто сейчас в саду и журнал отметок (docs/admin-screens.md).
 * «Кто в саду» — сначала филиалы, внутри филиала дети по группам (branch/[id].tsx). Если филиал один — его группы
 * сразу здесь. На старом бэкенде без групп — общим списком. Журнал — без фильтров.
 * Если в саду включено подтверждение посещений — ещё и «Очередь»: отметки, которые ждут сотрудника
 * (components/visit-queue.tsx).
 */
export default function VisitsScreen() {
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const employee = useAppSelector(state => state.auth.user?.role === 'EMPLOYEE');
  const presence = useAppSelector(state => state.visits.present.data);
  const groups = useMemo(() => staffGroups(presence), [presence]);
  const [selection, setSelection] = useState<StaffGroup>();
  const selected = groups.find(group => group.id === selection?.id);
  const [mode, setMode] = useState<Mode>('present');
  const queueEnabled = useAppSelector((state) => state.visitQueue.enabled === true);
  const waiting = useAppSelector((state) => state.visitQueue.items.length + state.visitQueue.otherCount);

  // Очередь открывается первой, пока в ней кто-то ждёт, — один раз, дальше режим выбирает сотрудник
  const openedQueue = useRef(false);
  useEffect(() => {
    if (queueEnabled && waiting > 0 && !openedQueue.current) {
      openedQueue.current = true;
      setMode('queue');
    }
  }, [queueEnabled, waiting]);

  const options = useMemo(() => {
    const modes = employee ? MODE_OPTIONS.filter(option => option.value !== 'journal') : MODE_OPTIONS;
    return queueEnabled
      ? [{ value: 'queue' as const, label: waiting ? `Очередь ${waiting}` : 'Очередь' }, ...modes]
      : modes;
  }, [employee, queueEnabled, waiting]);
  const shown = options.some(option => option.value === mode) ? mode : 'present';

  // При каждом возврате на вкладку и смене режима — свежие данные: родители отмечают детей в течение дня
  useFocusEffect(
    useCallback(() => {
      // Включено ли подтверждение и сколько ждут — нужно в любом режиме: это число на переключателе
      dispatch(openQueue());
      if (shown === 'queue') {
        dispatch(loadQueueStart());
        // Группы для выбора «моих групп» берутся из «Кто в саду»
        dispatch(loadPresentStart());
      } else {
        dispatch(shown === 'present' ? loadPresentStart() : loadJournalStart());
      }
    }, [dispatch, shown])
  );

  const { day, reload: reloadAbsences } = useAbsenceDayEntry(shown === 'present');

  const reloadPresent = (refresh: boolean) => {
    dispatch(loadPresentStart({ refresh }));
    reloadAbsences();
  };

  return (
    <View style={styles.screen}>
      {options.length > 1 && <View style={styles.switcher}>
        <SegmentedControl options={options} value={shown} onChange={setMode} compact />
      </View>}
      {employee && shown === 'present' && <StaffGroupSelect groups={groups} selected={selected} onSelect={setSelection} />}
      {shown === 'present' && <AbsenceDayEntry day={day} groupId={employee ? selected?.id : undefined} groupName={employee ? selected?.name : undefined} />}
      {shown === 'queue' && <VisitQueue />}
      {shown === 'present' && (employee
        ? <StaffPresenceList groupId={selected?.id} onReload={reloadPresent} />
        : <PresentList onReload={reloadPresent} />)}
      {shown === 'journal' && <JournalList />}
    </View>
  );
}

function childrenCount(count: number): string {
  return `${count} ${plural(count, ['ребёнок', 'ребёнка', 'детей'])}`;
}

function PresentList({ onReload }: { onReload: (refresh: boolean) => void }) {
  const { data, status, refreshing } = useAppSelector((state) => state.visits.present);
  const reload = () => onReload(true);
  const onlyBranch = useMemo(() => singleBranchId(data), [data]);
  const openGroup = useOpenGroupMembers();

  if (status !== 'loaded') {
    return <LoadState status={status} onRetry={() => onReload(false)} />;
  }

  // Бэкенд без разбивки по группам — один общий список без заголовка
  if (data.groups === null) {
    const sections = data.withoutGroup.length > 0
      ? [{ key: 'all', title: '', group: null, emptyText: null, data: data.withoutGroup }]
      : [];
    return (
      <PresenceSections
        sections={sections}
        header={`В саду ${childrenCount(data.total)}`}
        emptyText="Сейчас в саду никого нет"
        refreshing={refreshing}
        onRefresh={reload}
      />
    );
  }

  // Один филиал — выбирать нечего, сразу группы
  if (onlyBranch) {
    return (
      <PresenceSections
        sections={branchSections(data, onlyBranch)}
        header={`В саду ${childrenCount(data.total)}`}
        emptyText="В саду пока нет групп"
        refreshing={refreshing}
        onRefresh={reload}
        onEditGroup={openGroup}
      />
    );
  }

  return <BranchList summaries={branchSummaries(data)} total={data.total} refreshing={refreshing} onRefresh={reload} />;
}

function BranchList({
  summaries,
  total,
  refreshing,
  onRefresh,
}: {
  summaries: BranchSummary[];
  total: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const router = useRouter();
  const empty = summaries.length === 0;

  return (
    <FlatList
      data={summaries}
      keyExtractor={(item) => item.id}
      contentContainerStyle={empty ? visitListStyles.emptyContainer : visitListStyles.listContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={empty ? null : <Text style={visitListStyles.total}>В саду {childrenCount(total)}</Text>}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={[
            visitListStyles.row,
            styles.branchRow,
            index === 0 && visitListStyles.rowFirst,
            index === summaries.length - 1 && visitListStyles.rowLast,
          ]}
          onPress={() => router.push({ pathname: '/visits/branch/[id]', params: { id: item.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}: в саду ${item.present}${item.total === null ? '' : ` из ${item.total}`}`}
        >
          <View style={styles.rowText}>
            <Text style={visitListStyles.rowTitle}>{item.name}</Text>
            {item.total === null ? null : (
              <Text style={styles.rowSubtitle}>
                {item.groupCount === 0
                  ? 'Групп нет'
                  : `${item.groupCount} ${plural(item.groupCount, ['группа', 'группы', 'групп'])}`}
              </Text>
            )}
          </View>
          <Text style={[styles.count, item.present > 0 && styles.countPresent]}>
            {item.total === null ? item.present : `${item.present} из ${item.total}`}
          </Text>
          <IconSymbol name="chevron.right" size={22} color={c.textTertiary} />
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={visitListStyles.message}>Филиалов пока нет</Text>}
    />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    switcher: {
      paddingHorizontal: space.lg,
      paddingTop: space.md,
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
    },
    branchRow: {
      paddingVertical: 14,
    },
    rowText: {
      flex: 1,
    },
    rowSubtitle: {
      marginTop: 2,
      fontSize: 13,
      color: c.textSecondary,
    },
    count: {
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      color: c.textTertiary,
      marginLeft: 12,
      marginRight: 4,
    },
    countPresent: {
      color: c.success,
      fontWeight: '600',
    },
  })
);
