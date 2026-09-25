import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SegmentedControl from '../../../components/segmented-control';
import { useAppDispatch, useAppSelector } from '../../../store';
import { loadJournalMore, loadJournalStart, loadPresentStart } from '../../../store/reducers/visits';
import { LoadStatus, Presence, PresentChild, VisitEntry } from '../../../store/types/visits';
import { plural } from '../../../utils/plural';
import { dayTitle, localDayKey, timeOfDay } from '../../../utils/visit-dates';

type Mode = 'present' | 'journal';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'present', label: 'Кто в саду' },
  { value: 'journal', label: 'Журнал' },
];

/**
 * Вкладка «Посещение»: кто сейчас в саду и журнал отметок (docs/admin-screens.md).
 * «Кто в саду» — по группам из GET /group/presence (на старом бэкенде — общим списком), журнал — без фильтров.
 */
export default function VisitsScreen() {
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<Mode>('present');

  // При каждом возврате на вкладку и смене режима — свежие данные: родители отмечают детей в течение дня
  useFocusEffect(
    useCallback(() => {
      dispatch(mode === 'present' ? loadPresentStart() : loadJournalStart());
    }, [dispatch, mode])
  );

  return (
    <View style={styles.screen}>
      <View style={styles.switcher}>
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </View>
      {mode === 'present' ? <PresentList /> : <Journal />}
    </View>
  );
}

interface PresentSection {
  key: string;
  title: string;
  /** Группа, где сейчас никого: заголовок без строк */
  empty: boolean;
  data: PresentChild[];
}

/**
 * Группы с детьми по названию (порядок задаёт сервер), затем дети без группы.
 * Группы, в которых вообще нет детей, не показываем.
 */
function presentSections(presence: Presence): PresentSection[] {
  if (presence.groups === null) {
    // Бэкенд без разбивки по группам — один общий список без заголовка
    return [{ key: 'all', title: '', empty: false, data: presence.withoutGroup }];
  }
  const sections: PresentSection[] = presence.groups
    .filter((group) => group.totalChildren > 0 || group.present.length > 0)
    .map((group) => ({
      key: group.id,
      title: `${group.name} · ${group.present.length} из ${group.totalChildren}`,
      empty: group.present.length === 0,
      data: group.present,
    }));
  if (presence.withoutGroup.length > 0) {
    sections.push({
      key: 'without-group',
      title: `Без группы · ${presence.withoutGroup.length}`,
      empty: false,
      data: presence.withoutGroup,
    });
  }
  return sections;
}

function PresentList() {
  const dispatch = useAppDispatch();
  const { data, status, refreshing } = useAppSelector((state) => state.visits.present);
  const sections = useMemo(() => presentSections(data), [data]);
  const reload = () => dispatch(loadPresentStart({ refresh: true }));

  if (status !== 'loaded') {
    return <LoadState status={status} onRetry={() => dispatch(loadPresentStart())} />;
  }

  const nobody = data.total === 0;

  return (
    <SectionList
      sections={nobody ? [] : sections}
      keyExtractor={(child, index) => `${child.id}-${index}`}
      contentContainerStyle={nobody ? styles.emptyContainer : styles.listContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        nobody ? null : (
          <Text style={styles.total}>
            В саду {data.total} {plural(data.total, ['ребёнок', 'ребёнка', 'детей'])}
          </Text>
        )
      }
      renderSectionHeader={({ section }) =>
        section.title ? (
          <View>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            {section.empty ? <Text style={styles.sectionEmpty}>Сейчас никого нет</Text> : null}
          </View>
        ) : null
      }
      renderItem={({ item, index, section }) => (
        <View
          style={[
            styles.row,
            index === 0 && styles.rowFirst,
            index === section.data.length - 1 && styles.rowLast,
          ]}
        >
          <View style={[styles.dot, styles.dotIn]} />
          <Text style={styles.rowTitle}>{`${item.firstName} ${item.surname}`.trim()}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.message}>Сейчас в саду никого нет</Text>}
    />
  );
}

interface JournalSection {
  key: string;
  title: string;
  data: VisitEntry[];
}

function Journal() {
  const dispatch = useAppDispatch();
  const { items, status, refreshing, last, loadingMore, loadMoreFailed } = useAppSelector(
    (state) => state.visits.journal
  );

  // Отметки уже отсортированы по убыванию времени: подряд идущие одного дня — одна секция
  const sections = useMemo(() => {
    const result: JournalSection[] = [];
    for (const entry of items) {
      const key = localDayKey(entry.datetime);
      const current = result[result.length - 1];
      if (current?.key === key) {
        current.data.push(entry);
      } else {
        result.push({ key, title: dayTitle(entry.datetime), data: [entry] });
      }
    }
    return result;
  }, [items]);

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
    footer = <ActivityIndicator style={styles.footer} color="#999" />;
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
      keyExtractor={(entry) => entry.key}
      contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => dispatch(loadJournalStart({ refresh: true }))} />
      }
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
      )}
      renderItem={({ item, index, section }) => (
        <View
          style={[
            styles.row,
            index === 0 && styles.rowFirst,
            index === section.data.length - 1 && styles.rowLast,
          ]}
        >
          <Text style={styles.time}>{timeOfDay(item.datetime)}</Text>
          <View style={[styles.dot, item.status === 'IN' ? styles.dotIn : styles.dotOut]} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{item.childName}</Text>
            {/* Пол ни ребёнка, ни представителя сервер не отдаёт, поэтому без «пришла / привела» */}
            <Text style={styles.rowSubtitle}>
              {item.status === 'IN' ? 'Приход' : 'Уход'} · {item.representativeName}
            </Text>
          </View>
        </View>
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={footer}
      ListEmptyComponent={<Text style={styles.message}>Отметок пока нет</Text>}
    />
  );
}

function LoadState({ status, onRetry }: { status: LoadStatus; onRetry: () => void }) {
  if (status === 'failed') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Не удалось загрузить данные</Text>
        <TouchableOpacity style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  switcher: {
    paddingHorizontal: 20,
    paddingTop: 16,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  total: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionEmpty: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#888',
    marginTop: 8,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  rowFirst: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  rowLast: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomWidth: 0,
    marginBottom: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    color: '#333',
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#666',
  },
  time: {
    width: 48,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    color: '#333',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  dotIn: {
    backgroundColor: '#2E7D32',
  },
  dotOut: {
    backgroundColor: '#888',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  retry: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  link: {
    color: '#007AFF',
    fontSize: 15,
  },
});
