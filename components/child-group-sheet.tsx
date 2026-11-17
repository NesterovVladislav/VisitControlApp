import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RefreshControl } from './ui/refresh-control';
import { useVisitListStyles } from './visit-list';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { visitControlApi } from '../services/api';
import { ApiError } from '../services/errors/api-error';
import { Child, ChildGroup } from '../store/types/children';

interface ChildGroupSheetProps {
  /** Чью группу показать; null — шторка закрыта */
  child: Child | null;
  onClose: () => void;
}

type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; group: ChildGroup };

/**
 * Группа ребёнка для родителя: дети группы и кто из них сейчас в саду — зелёный кружок, кого нет — серый.
 * Только фамилия и имя: остальное о чужих детях родителю не показывается. Список живёт, пока шторка открыта,
 * и в общем хранилище не лежит.
 */
export default function ChildGroupSheet({ child, onClose }: ChildGroupSheetProps) {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const childId = child?.id ?? null;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      if (!childId) return;
      try {
        const group = await visitControlApi.getChildGroup(childId);
        if (isCurrent()) setState({ status: 'loaded', group });
      } catch (error) {
        console.warn('[Child Group] Failed to load', error instanceof ApiError ? error.status : error);
        if (isCurrent()) setState({ status: 'failed' });
      }
    },
    [childId]
  );

  // Каждое открытие — свежий список: дети приходят и уходят в течение дня
  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    void load(() => current);
    return () => {
      current = false;
    };
  }, [load]);

  if (!child) {
    return null;
  }

  const group = state.status === 'loaded' ? state.group : null;
  const presentCount = group ? group.children.filter((member) => member.present).length : 0;

  let body: React.ReactNode;
  if (state.status === 'loading') {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  } else if (state.status === 'failed') {
    body = (
      <View style={styles.center}>
        <Text style={styles.message}>Не удалось загрузить группу</Text>
        <TouchableOpacity
          style={styles.retry}
          onPress={() => {
            setState({ status: 'loading' });
            void load();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (state.group.children.length === 0) {
    body = (
      <View style={styles.center}>
        <Text style={styles.message}>
          {state.group.name ? 'В группе пока нет детей' : 'Сад ещё не определил ребёнка в группу'}
        </Text>
      </View>
    );
  } else {
    const members = state.group.children;
    body = (
      <FlatList
        data={members}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item, index }) => (
          <View
            style={[
              visitListStyles.row,
              index === 0 && visitListStyles.rowFirst,
              index === members.length - 1 && visitListStyles.rowLast,
            ]}
          >
            <View
              style={[visitListStyles.dot, item.present ? visitListStyles.dotIn : visitListStyles.dotOut]}
              accessibilityLabel={item.present ? 'В саду' : 'Не в саду'}
            />
            <Text style={[visitListStyles.rowTitle, item.own && styles.own]}>
              {`${item.surname} ${item.firstName}`.trim()}
            </Text>
          </View>
        )}
      />
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{group?.name ? `Группа «${group.name}»` : 'Группа'}</Text>
            {group && group.children.length > 0 ? (
              <Text style={styles.subtitle}>
                В саду {presentCount} из {group.children.length}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.close}>Закрыть</Text>
          </TouchableOpacity>
        </View>
        {body}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 28,
      paddingBottom: 12,
    },
    headerText: {
      flex: 1,
      marginRight: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: c.text,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 16,
      color: c.textSecondary,
    },
    close: {
      fontSize: 16,
      color: c.primary,
    },
    list: {
      padding: 20,
    },
    own: {
      fontWeight: '600',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    message: {
      fontSize: 16,
      color: c.textSecondary,
      textAlign: 'center',
    },
    retry: {
      marginTop: 16,
      minHeight: 44,
      justifyContent: 'center',
    },
    retryText: {
      fontSize: 16,
      fontWeight: '500',
      color: c.primary,
    },
  })
);
