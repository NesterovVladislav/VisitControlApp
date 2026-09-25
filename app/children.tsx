import { useFocusEffect } from '@react-navigation/native';
import { Redirect, Stack } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ChildCard, { markActionLabel } from '../components/child-card';
import { useAppDispatch, useAppSelector } from '../store';
import { logout } from '../store/reducers/auth';
import {
  clearMarkError,
  loadChildrenStart,
  loadStatusStart,
  markVisitStart,
  refreshStatuses,
} from '../store/reducers/children';
import { Child, isInKindergarten } from '../store/types/children';

export default function ChildrenScreen() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const { items, listStatus, refreshing, statusById, markingIds, markError } = useAppSelector(
    (state) => state.children
  );

  const listStatusRef = useRef(listStatus);
  listStatusRef.current = listStatus;

  // При каждом возврате на экран перечитываем статусы: второй представитель мог отметить ребёнка.
  const reload = useCallback(() => {
    if (listStatusRef.current === 'loaded') {
      dispatch(refreshStatuses());
    } else if (listStatusRef.current !== 'loading') {
      dispatch(loadChildrenStart());
    }
  }, [dispatch]);

  useFocusEffect(reload);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reload();
      }
    });
    return () => subscription.remove();
  }, [reload]);

  useEffect(() => {
    if (markError) {
      Alert.alert('Отметка не сохранена', markError.message, [
        { text: 'OK', onPress: () => dispatch(clearMarkError()) },
      ]);
    }
  }, [markError, dispatch]);

  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  function confirmMark(child: Child) {
    const seenStatus = statusById[child.id]?.value;
    if (!seenStatus) {
      return;
    }
    const inKindergarten = isInKindergarten(seenStatus);
    // Пол ребёнка сервер не отдаёт, поэтому вопрос без согласования по роду
    const question = inKindergarten ? 'Отметить уход из сада?' : 'Отметить приход в сад?';
    Alert.alert(`${child.firstName} ${child.surname}`.trim(), question, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: markActionLabel(inKindergarten, user?.gender ?? null),
        onPress: () => dispatch(markVisitStart({ childId: child.id, seenStatus })),
      },
    ]);
  }

  function confirmLogout() {
    Alert.alert('Выйти из аккаунта?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  }

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <TouchableOpacity onPress={confirmLogout} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.headerButton}>Выйти</Text>
          </TouchableOpacity>
        ),
      }}
    />
  );

  if (listStatus === 'idle' || listStatus === 'loading') {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (listStatus === 'failed') {
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.message}>Не удалось загрузить данные</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => dispatch(loadChildrenStart())}>
          <Text style={styles.secondaryButtonText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      {header}
      <FlatList
        style={styles.list}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.container}
        data={items}
        keyExtractor={(child) => child.id}
        renderItem={({ item }) => (
          <ChildCard
            child={item}
            status={statusById[item.id]}
            gender={user?.gender ?? null}
            marking={markingIds.includes(item.id)}
            onMark={() => confirmMark(item)}
            onRetryStatus={() => dispatch(loadStatusStart(item.id))}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => dispatch(loadChildrenStart({ refresh: true }))}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.message}>
              К вашему аккаунту пока не привязаны дети. Администратор сада добавит их после проверки
              заявки
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => dispatch(loadChildrenStart({ refresh: true }))}
            >
              <Text style={styles.secondaryButtonText}>Обновить</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    padding: 20,
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
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  empty: {
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerButton: {
    color: '#007AFF',
    fontSize: 16,
  },
});
