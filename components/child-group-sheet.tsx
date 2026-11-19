import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, StatusMessage } from './ui';
import { RefreshControl } from './ui/refresh-control';
import { space, typeSize } from '../constants/ui-tokens';
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
  const present = group?.children.filter((member) => member.present) ?? [];
  const away = group?.children.filter((member) => !member.present) ?? [];
  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title} accessibilityRole="header">{group?.name ? `Группа «${group.name}»` : 'Группа'}</Text>
        {onClose && group && group.children.length > 0 &&
          <Text style={styles.subtitle}>В саду {present.length} из {group.children.length}</Text>}
      </View>
      {onClose && <ActionButton variant="text" label="Закрыть" onPress={onClose} />}
    </View>
  );

  return (
    <SectionList
      style={styles.screen}
      sections={group?.children.length ? [
        { title: 'В саду', data: present }, { title: 'Сейчас нет', data: away },
      ] : []}
      contentContainerStyle={styles.content}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      keyExtractor={(item, index) => `${item.surname}-${item.firstName}-${index}`}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle} accessibilityRole="header">{section.title} · {section.data.length}</Text>
      )}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View accessibilityLabel={item.present ? 'В саду' : 'Не в саду'}
            style={[styles.dot, { backgroundColor: item.present ? c.success : c.textTertiary }]} />
          <Text style={[styles.member, item.own && styles.own]}>{`${item.surname} ${item.firstName}`.trim()}</Text>
        </View>
      )}
      ListEmptyComponent={
        state.status === 'loading' ? <ActivityIndicator accessibilityLabel="Загружаем группу" color={c.actionPrimary} /> :
          state.status === 'failed' ? (
            <View style={styles.empty}>
              <StatusMessage message="Не удалось загрузить группу" tone="error" />
              <ActionButton variant="text" label="Повторить" onPress={() => void load()} />
            </View>
          ) : <StatusMessage message={group?.name ? 'В группе пока нет детей' : 'Сад ещё не определил ребёнка в группу'} />
      }
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
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.section,
    width: '100%', maxWidth: 440, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  headerText: { flex: 1, gap: space.xxs },
  title: { fontSize: typeSize.sheetTitle, fontWeight: '700', color: c.text },
  subtitle: { fontSize: typeSize.label, color: c.textSecondary },
  sectionTitle: { marginTop: space.lg, marginBottom: space.sm, fontSize: typeSize.label,
    fontWeight: '600', color: c.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator },
  dot: { width: space.sm, height: space.sm, borderRadius: space.sm },
  member: { flex: 1, fontSize: typeSize.body, color: c.text },
  own: { fontWeight: '700' },
  empty: { gap: space.md },
}));
