import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, StatusMessage } from './ui';
import { IconSymbol } from './ui/icon-symbol';
import { RefreshControl } from './ui/refresh-control';
import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { visitControlApi } from '../services/api';
import { ApiError } from '../services/errors/api-error';
import type { Child, ChildGroup } from '../store/types/children';

type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; group: ChildGroup };

interface PanelProps {
  child: Child;
  onClose?: () => void;
}

export function ChildGroupPanel({ child, onClose }: PanelProps) {
  // Reset the list immediately, including a refresh in flight, when switching children.
  return <GroupContents key={child.id} child={child} onClose={onClose} />;
}

function GroupContents({ child, onClose }: PanelProps) {
  const c = usePalette();
  const styles = useStyles();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);
  const invalidateRequest = useCallback(() => ++request.current, []);

  const load = useCallback(async (refresh = false) => {
    const id = invalidateRequest();
    if (refresh) setRefreshing(true);
    else setState({ status: 'loading' });
    try {
      const group = await visitControlApi.getChildGroup(child.id);
      if (id === request.current) setState({ status: 'loaded', group });
    } catch (error) {
      if (id !== request.current) return;
      console.warn('[Child Group] Failed to load', error instanceof ApiError ? error.status : error);
      setState({ status: 'failed' });
    } finally {
      if (id === request.current) setRefreshing(false);
    }
  }, [child.id, invalidateRequest]);

  useFocusEffect(useCallback(() => {
    void load();
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') void load(true);
    });
    return () => {
      invalidateRequest();
      subscription.remove();
      setState({ status: 'loading' });
    };
  }, [load, invalidateRequest]));

  const group = state.status === 'loaded' ? state.group : undefined;
  const present = group?.children.filter(member => member.present).length ?? 0;
  const header = (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">{group?.name || 'Группа'}</Text>
      {group?.name && (
        <Text style={styles.count} accessibilityLabel={`В саду ${present} из ${group.children.length}`}>
          {`${present}/${group.children.length}`}
        </Text>
      )}
      {onClose && <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={onClose} style={styles.close}>
        <IconSymbol name="xmark" size={22} color={c.textSecondary} />
      </Pressable>}
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      data={group?.children ?? []}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      keyExtractor={(item, index) => `${item.surname}-${item.firstName}-${index}`}
      renderItem={({ item, index }) => (
        <View style={[styles.row, index === (group?.children.length ?? 0) - 1 && styles.last]} accessible accessibilityLabel={`${item.surname} ${item.firstName}, ${item.present ? 'В саду' : 'Не в саду'}`}>
          <View
            style={[styles.dot, { backgroundColor: item.present ? c.success : c.textTertiary }]} />
          <Text style={[styles.member, item.own && styles.own]}>{`${item.surname} ${item.firstName}`.trim()}</Text>
        </View>
      )}
      ListEmptyComponent={<View style={[styles.empty, styles.last]}>{
        state.status === 'loading' ? <ActivityIndicator accessibilityLabel="Загружаем группу" color={c.actionPrimary} /> :
          state.status === 'failed' ? (
            <>
              <StatusMessage message="Не удалось загрузить группу" tone="error" />
              <ActionButton variant="text" label="Повторить" onPress={() => void load()} />
            </>
          ) : <StatusMessage message={group?.name ? 'В группе пока нет детей' : 'Сад ещё не определил ребёнка в группу'} />
      }</View>}
    />
  );
}

export default function ChildGroupSheet({ child, onClose }: { child: Child | null; onClose: () => void }) {
  const styles = useStyles();
  if (!child) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}><ChildGroupPanel child={child} onClose={onClose} /></SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: space.md, paddingBottom: space.section,
    width: '100%', maxWidth: 440, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, backgroundColor: c.card,
    borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  last: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  close: { alignItems: 'center', justifyContent: 'center', width: controlHeight.touch, height: controlHeight.touch },
  title: { flex: 1, fontSize: typeSize.sheetTitle, fontWeight: '700', color: c.text },
  count: { fontSize: typeSize.body, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, minHeight: controlHeight.field,
    backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
  dot: { width: space.sm, height: space.sm, borderRadius: space.sm },
  member: { flex: 1, fontSize: typeSize.body, color: c.text },
  own: { fontWeight: '700' },
  empty: { gap: space.md, padding: space.lg, backgroundColor: c.card },
}));
