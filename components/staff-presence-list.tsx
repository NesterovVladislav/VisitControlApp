import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles } from '../hooks/use-palette';
import { useAppSelector } from '../store';
import { PresentChild } from '../store/types/visits';
import { personName } from '../utils/people-format';
import { pendingSuffix } from '../utils/presence';
import { RefreshControl } from './ui/refresh-control';
import { LoadState } from './visit-list';

export default function StaffPresenceList({ groupId, onReload }: {
  groupId?: string; onReload: (refresh: boolean) => void;
}) {
  const styles = useStyles();
  const { data, status, refreshing } = useAppSelector(state => state.visits.present);
  const sections = useMemo(() => {
    const childrenByName = (children: PresentChild[]) =>
      [...children].sort((a, b) => personName(a).localeCompare(personName(b), 'ru'));
    if (data.groups === null) {
      return data.withoutGroup.length ? [{ key: 'flat', name: 'В саду', count: String(data.total), pending: '',
        data: childrenByName(data.withoutGroup) }] : [];
    }
    const branchNames = new Map(data.branches.map(branch => [branch.id, branch.name]));
    return data.groups.filter(group => !groupId || group.id === groupId).map(group => {
      const branch = group.branchId && branchNames.get(group.branchId);
      const name = branch && data.branches.length > 1 ? `${group.name} · ${branch}` : group.name;
      return { key: group.id, name, count: `${group.present.length}/${group.totalChildren}`,
        pending: pendingSuffix(group).replace(/^ · /, ''), data: childrenByName(group.present) };
    });
  }, [data, groupId]);

  if (status !== 'loaded') return <LoadState status={status} onRetry={() => onReload(false)} />;
  return <SectionList sections={sections} keyExtractor={child => child.id} stickySectionHeadersEnabled={false}
    contentContainerStyle={styles.list}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => onReload(true)} />}
    renderSectionHeader={({ section }) => <View style={styles.heading}>
      <View style={styles.line}><Text accessibilityRole="header" style={styles.name}>{section.name}</Text>
        <Text accessibilityLabel={`В саду ${section.count.replace('/', ' из ')}`} style={styles.count}>{section.count}</Text></View>
      {section.pending ? <Text style={styles.note}>{section.pending}</Text> : null}
    </View>}
    renderItem={({ item, index, section }) => <View style={[styles.row, index === section.data.length - 1 && styles.last]}>
      <View style={styles.dot} /><Text style={styles.child}>{personName(item)}</Text>
    </View>}
    renderSectionFooter={({ section }) => !section.data.length ? <View style={[styles.row, styles.last]}>
      <Text style={styles.note}>{section.count === '0/0' ? 'В группе пока нет детей' : 'Сейчас никого нет в саду'}</Text>
    </View> : null}
    ListEmptyComponent={<Text style={styles.empty}>{data.groups === null ? 'Сейчас в саду никого нет' : 'Нет доступных групп'}</Text>} />;
}

const useStyles = makeStyles(c => StyleSheet.create({
  list: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: space.lg, paddingBottom: space.xxl },
  heading: { marginTop: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: c.card,
    borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontSize: typeSize.body, fontWeight: '700', color: c.text },
  count: { fontSize: typeSize.body, color: c.textSecondary, fontVariant: ['tabular-nums'] },
  row: { minHeight: 44, flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: c.card,
    paddingHorizontal: space.lg, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  last: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  child: { flex: 1, fontSize: typeSize.body, color: c.text },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.success },
  note: { color: c.textSecondary, fontSize: typeSize.label },
  empty: { marginTop: space.xxl, textAlign: 'center', color: c.textSecondary, fontSize: typeSize.body },
}));
