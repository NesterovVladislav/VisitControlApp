import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { useAppDispatch, useAppSelector } from '../store';
import { loadJournalMore, loadJournalStart } from '../store/reducers/visits';
import { confirmationLabel, intervalLabels, journalSections, representativesLabel } from '../utils/journal';
import { timeOfDay } from '../utils/visit-dates';
import { StaffGroup, StaffGroupSelect, staffGroups } from './staff-group-select';
import { RefreshControl } from './ui/refresh-control';
import { LoadState } from './visit-list';

export default function JournalList({ selectable = false }: { selectable?: boolean }) {
  const styles = useStyles();
  const c = usePalette();
  const dispatch = useAppDispatch();
  const focused = useIsFocused();
  const presence = useAppSelector(state => state.visits.present.data);
  const { items, status, refreshing, last, loadingMore, loadMoreFailed, page } = useAppSelector(state => state.visits.journal);
  const groups = useMemo(() => staffGroups(presence, items), [presence, items]);
  const [selected, setSelected] = useState<StaffGroup>();
  const [pageGoal, setPageGoal] = useState(1);
  useFocusEffect(useCallback(() => { setPageGoal(1); }, []));
  useEffect(() => {
    if (status === 'failed') setSelected(undefined);
  }, [status]);
  const sections = useMemo(() => journalSections(
    selected ? items.filter(entry => entry.group?.id === selected.id) : items,
    presence.branches.length > 1, new Date(), selectable
  ), [items, selected, presence.branches.length, selectable]);

  // GET /visit/list paginates the authorised history before the local group filter.
  // A page without a matching child is not evidence of an empty journal.
  const rowCount = sections.reduce((count, section) => count + section.data.length, 0);
  const canLoadMore = focused && status === 'loaded' && !refreshing && !last && !loadingMore && !loadMoreFailed;
  useEffect(() => {
    if (canLoadMore && rowCount < pageGoal) dispatch(loadJournalMore());
  }, [dispatch, canLoadMore, rowCount, pageGoal, page]);

  function selectGroup(group: StaffGroup | undefined) {
    setPageGoal(1);
    setSelected(group);
  }

  function requestMore() {
    if (canLoadMore) setPageGoal(rowCount + 1);
  }

  if (status !== 'loaded') return <LoadState status={status} onRetry={() => dispatch(loadJournalStart())} />;
  return <View style={styles.screen}>
    {selectable && <StaffGroupSelect groups={groups} selected={selected} onSelect={selectGroup} />}
    <SectionList sections={sections} keyExtractor={item => item.key} contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setPageGoal(1); dispatch(loadJournalStart({ refresh: true })); }} />}
      onEndReached={requestMore} onEndReachedThreshold={0.4}
      renderSectionHeader={({ section }) => <View>
        {section.dayTitle ? <Text accessibilityRole="header" style={styles.day}>{section.dayTitle}</Text> : null}
        {!selected && <Text accessibilityRole="header" style={styles.heading}>{selectable ? section.title : section.title.toUpperCase()}</Text>}
      </View>}
      renderItem={({ item, index, section }) => {
        const labels = intervalLabels(item);
        const interval = item.intervals[0];
        const compactTime = selectable && interval?.in && (interval.out || item.inNow)
          ? [timeOfDay(interval.in), ...(interval.out ? [timeOfDay(interval.out)] : [])].join(' — ')
          : labels[0];
        return <View style={[styles.row, selected && index === 0 && styles.first, index === section.data.length - 1 && styles.last]}>
          <View style={styles.line}>
            <Text style={styles.name}>{item.childName}</Text>
            {item.intervals.length === 1 && <Text accessibilityLabel={labels[0]} style={styles.time}>{compactTime}</Text>}
          </View>
          {item.intervals.map((interval, i) => {
            const representative = representativesLabel(interval);
            const confirmation = confirmationLabel(interval);
            return <View key={i} style={styles.metadata}>
              {item.intervals.length > 1 && <Text style={styles.time}>{labels[i]}</Text>}
              {representative && <Text style={styles.note}>{representative}</Text>}
              {confirmation && <Text style={styles.note}>{confirmation}</Text>}
            </View>;
          })}
          {item.comments.map((comment, i) => <Text key={i} style={styles.note}>«{comment}»</Text>)}
        </View>;
      }}
      ListEmptyComponent={last ? <Text style={styles.message}>{selected ? 'В этой группе пока нет отметок' : 'Отметок пока нет'}</Text> : null}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={c.actionPrimary} /> :
        (!last || loadMoreFailed) ? <Pressable accessibilityRole="button" style={styles.footer} disabled={refreshing}
          onPress={loadMoreFailed ? () => dispatch(loadJournalMore()) : requestMore}><Text style={styles.link}>
            {loadMoreFailed ? 'Не удалось загрузить. Повторить' : 'Показать ещё'}
          </Text></Pressable> : null} />
  </View>;
}

const useStyles = makeStyles(c => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  list: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: space.lg, paddingBottom: space.xxl },
  day: { fontSize: typeSize.body, fontWeight: '600', color: c.text, marginTop: space.lg, marginBottom: space.sm },
  heading: { color: c.text, fontSize: typeSize.body, fontWeight: '700', backgroundColor: c.card,
    borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.md },
  row: { backgroundColor: c.card, paddingHorizontal: space.lg, paddingVertical: space.md,
    borderColor: c.separator, borderTopWidth: StyleSheet.hairlineWidth },
  first: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderTopWidth: 0 },
  last: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, marginBottom: space.sm },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.xs },
  name: { flexGrow: 1, flexShrink: 1, fontSize: typeSize.body, fontWeight: '600', color: c.text },
  time: { fontSize: typeSize.label, color: c.textSecondary, fontVariant: ['tabular-nums'], flexShrink: 1 },
  metadata: { gap: space.xxs },
  note: { color: c.textSecondary, fontSize: typeSize.label, marginTop: space.xxs },
  message: { marginVertical: space.section, textAlign: 'center', fontSize: typeSize.body, color: c.textSecondary },
  footer: { minHeight: controlHeight.touch, alignItems: 'center', justifyContent: 'center' },
  link: { color: c.actionPrimary, fontSize: typeSize.body },
}));
