import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SegmentedControl from '../../../components/segmented-control';
import { IconSymbol } from '../../../components/ui/icon-symbol';
import { LoadState, PresenceSections, useVisitListStyles } from '../../../components/visit-list';
import VisitQueue from '../../../components/visit-queue';
import { useOpenGroupMembers } from '../../../hooks/use-open-group-members';
import { useAppDispatch, useAppSelector } from '../../../store';
import { loadQueueStart, openQueue } from '../../../store/reducers/visit-queue';
import { loadJournalMore, loadJournalStart, loadPresentStart } from '../../../store/reducers/visits';
import { plural } from '../../../utils/plural';
import { BranchSummary, branchSections, branchSummaries, singleBranchId } from '../../../utils/presence';
import { confirmationLabel, intervalLabels, journalSections, representativesLabel } from '../../../utils/journal';
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

  // При каждом возврате на вкладку и смене режима — свежие данные: родители отмечают детей в течение дня
  useFocusEffect(
    useCallback(() => {
      // Включено ли подтверждение и сколько ждут — нужно в любом режиме: это число на переключателе
      dispatch(openQueue());
      if (mode === 'queue') {
        dispatch(loadQueueStart());
        // Группы для выбора «моих групп» берутся из «Кто в саду»
        dispatch(loadPresentStart());
      } else {
        dispatch(mode === 'present' ? loadPresentStart() : loadJournalStart());
      }
    }, [dispatch, mode])
  );

  const options = useMemo(
    () =>
      queueEnabled
        ? [{ value: 'queue' as Mode, label: waiting > 0 ? `Очередь ${waiting}` : 'Очередь' }, ...MODE_OPTIONS]
        : MODE_OPTIONS,
    [queueEnabled, waiting]
  );
  // Подтверждение выключили, пока очередь была на экране
  const shown: Mode = mode === 'queue' && !queueEnabled ? 'present' : mode;

  return (
    <View style={styles.screen}>
      <View style={styles.switcher}>
        <SegmentedControl options={options} value={shown} onChange={setMode} />
      </View>
      {shown === 'queue' ? <VisitQueue /> : shown === 'present' ? <PresentList /> : <Journal />}
    </View>
  );
}

function childrenCount(count: number): string {
  return `${count} ${plural(count, ['ребёнок', 'ребёнка', 'детей'])}`;
}

function PresentList() {
  const dispatch = useAppDispatch();
  const { data, status, refreshing } = useAppSelector((state) => state.visits.present);
  const reload = () => dispatch(loadPresentStart({ refresh: true }));
  const onlyBranch = useMemo(() => singleBranchId(data), [data]);
  const openGroup = useOpenGroupMembers();

  if (status !== 'loaded') {
    return <LoadState status={status} onRetry={() => dispatch(loadPresentStart())} />;
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

function Journal() {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const dispatch = useAppDispatch();
  const { items, status, refreshing, last, loadingMore, loadMoreFailed } = useAppSelector(
    (state) => state.visits.journal
  );
  const showBranch = useAppSelector((state) => state.visits.present.data.branches.length > 1);

  // День → группа → по строке на ребёнка: когда пришёл и ушёл, кто привёл и забрал
  const sections = useMemo(() => journalSections(items, showBranch), [items, showBranch]);

  if (status !== 'loaded') {
    return <LoadState status={status} onRetry={() => dispatch(loadJournalStart())} />;
  }

  const loadMore = () => {
    if (!last && !loadingMore && !loadMoreFailed) {
      dispatch(loadJournalMore());
    }
  };

  let footer: React.ReactElement | null = null;
  if (loadingMore) {
    footer = <ActivityIndicator style={styles.footer} color={c.textTertiary} />;
  } else if (loadMoreFailed) {
    footer = (
      <TouchableOpacity style={styles.footer} onPress={() => dispatch(loadJournalMore())}>
        <Text style={styles.link}>Не удалось загрузить. Повторить</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(row) => row.key}
      contentContainerStyle={items.length === 0 ? visitListStyles.emptyContainer : visitListStyles.listContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => dispatch(loadJournalStart({ refresh: true }))} />
      }
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View>
          {section.dayTitle ? <Text style={styles.dayTitle}>{section.dayTitle}</Text> : null}
          <Text style={visitListStyles.sectionTitle}>{section.title.toUpperCase()}</Text>
        </View>
      )}
      renderItem={({ item, index, section }) => {
        const labels = intervalLabels(item);
        return (
          <View
            style={[
              visitListStyles.row,
              styles.journalRow,
              index === 0 && visitListStyles.rowFirst,
              index === section.data.length - 1 && visitListStyles.rowLast,
            ]}
          >
            <View
              style={[visitListStyles.dot, styles.journalDot, item.inNow ? visitListStyles.dotIn : visitListStyles.dotOut]}
              accessibilityLabel={item.inNow ? 'В саду' : 'Не в саду'}
            />
            <View style={styles.rowText}>
              <Text style={visitListStyles.rowTitle}>{item.childName}</Text>
              {/* Каждое пребывание за день — отдельным блоком: своё время и свои взрослые */}
              {item.intervals.map((interval, intervalIndex) => {
                const representatives = representativesLabel(interval);
                const confirmation = confirmationLabel(interval);
                return (
                  <View key={intervalIndex} style={intervalIndex > 0 && styles.nextInterval}>
                    <Text style={styles.intervals}>{labels[intervalIndex]}</Text>
                    {representatives ? <Text style={styles.rowSubtitle}>{representatives}</Text> : null}
                    {confirmation ? <Text style={styles.rowSubtitle}>{confirmation}</Text> : null}
                  </View>
                );
              })}
              {item.comments.map((comment, commentIndex) => (
                <Text key={commentIndex} style={styles.rowSubtitle}>
                  «{comment}»
                </Text>
              ))}
            </View>
          </View>
        );
      }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={footer}
      ListEmptyComponent={<Text style={visitListStyles.message}>Отметок пока нет</Text>}
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
      paddingHorizontal: 20,
      paddingTop: 16,
      width: '100%',
      maxWidth: 440,
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
    dayTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
      marginTop: 12,
      marginBottom: 4,
    },
    journalRow: {
      alignItems: 'flex-start',
    },
    journalDot: {
      marginTop: 6,
    },
    nextInterval: {
      marginTop: 8,
    },
    intervals: {
      marginTop: 2,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      color: c.text,
    },
    footer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    link: {
      color: c.primary,
      fontSize: 15,
    },
  })
);
