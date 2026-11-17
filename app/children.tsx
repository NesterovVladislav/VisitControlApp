import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RefreshControl } from '../components/ui/refresh-control';
import ChildCard, { commentLabel, markActionLabel } from '../components/child-card';
import CommentSheet from '../components/comment-sheet';
import ChildGroupSheet from '../components/child-group-sheet';
import VisitQrSheet from '../components/visit-qr-sheet';
import { useAppDispatch, useAppSelector } from '../store';
import { logoutRequested, switchMode } from '../store/reducers/auth';
import {
  cancelMarkStart,
  clearMarkError,
  loadChildrenStart,
  loadStatusStart,
  markVisitStart,
  refreshStatuses,
} from '../store/reducers/children';
import { isAdminRole, isStaffRole } from '../store/types/auth';
import { Child, isInKindergarten, VISIT_COMMENT_MAX_LENGTH, VisitStatus } from '../store/types/children';
import { makeStyles, usePalette } from '../hooks/use-palette';

/** Как часто перечитывать статусы, пока отметка ждёт подтверждения сада */
const PENDING_POLL_MS = 12_000;

export default function ChildrenScreen() {
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { items, listStatus, refreshing, statusById, markingIds, markError, qrAvailable } = useAppSelector(
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

  // Пока отметка ждёт сотрудника сада, статус перечитываем сами: родитель смотрит на экран и ждёт ответа
  const waiting = Object.values(statusById).some((status) => status.visit?.pending);
  useFocusEffect(
    useCallback(() => {
      if (!waiting) {
        return undefined;
      }
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') {
          dispatch(refreshStatuses());
        }
      }, PENDING_POLL_MS);
      return () => clearInterval(timer);
    }, [waiting, dispatch])
  );

  // Ребёнок, по которому открыто окно подтверждения отметки, и статус, который видел пользователь
  const [marking, setMarking] = useState<{ child: Child; seenStatus: VisitStatus } | null>(null);

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

  function confirmMark(child: Child) {
    const seenStatus = statusById[child.id]?.value;
    if (!seenStatus) {
      return;
    }
    // Вместо Alert — шторка: в ней есть поле для комментария
    setMarking({ child, seenStatus });
  }

  function confirmCancel(child: Child) {
    Alert.alert(`${child.firstName} ${child.surname}`.trim(), 'Отменить отметку? Сад её ещё не подтвердил', [
      { text: 'Нет', style: 'cancel' },
      { text: 'Отменить отметку', style: 'destructive', onPress: () => dispatch(cancelMarkStart(child.id)) },
    ]);
  }

  // Ребёнок, чья группа сейчас открыта
  const [groupChildId, setGroupChildId] = useState<string | null>(null);
  const groupSheet = (
    <ChildGroupSheet
      child={items.find((child) => child.id === groupChildId) ?? null}
      onClose={() => setGroupChildId(null)}
    />
  );

  // Ребёнок, чей QR-код сейчас на экране. Следующий — тот, кому код тоже можно показать: у каждого ребёнка свой
  const [qrChildId, setQrChildId] = useState<string | null>(null);
  const qrChild = items.find((child) => child.id === qrChildId) ?? null;
  const qrCandidates = items.filter(
    (child) => statusById[child.id]?.value != null && !statusById[child.id]?.visit?.pending
  );
  const qrIndex = qrCandidates.findIndex((child) => child.id === qrChildId);
  const qrNext =
    qrCandidates.length > 1 && qrChildId
      ? qrCandidates[(qrIndex + 1) % qrCandidates.length] ?? null
      : null;
  const pollQrStatus = useCallback((childId: string) => dispatch(loadStatusStart(childId)), [dispatch]);
  const qrSheet = (
    <VisitQrSheet
      child={qrChild}
      status={qrChild ? statusById[qrChild.id]?.value ?? null : null}
      next={qrNext && qrNext.id !== qrChildId ? qrNext : null}
      onPoll={pollQrStatus}
      onNext={(child) => setQrChildId(child.id)}
      onClose={() => setQrChildId(null)}
    />
  );

  const markingInKindergarten = marking ? isInKindergarten(marking.seenStatus) : false;
  const markSheet = (
    <CommentSheet
      visible={marking !== null}
      title={marking ? `${marking.child.firstName} ${marking.child.surname}`.trim() : ''}
      // Пол ребёнка сервер не отдаёт, поэтому вопрос без согласования по роду
      message={markingInKindergarten ? 'Отметить уход из сада?' : 'Отметить приход в сад?'}
      label={commentLabel(markingInKindergarten)}
      placeholder="Необязательно"
      maxLength={VISIT_COMMENT_MAX_LENGTH}
      confirmLabel={markActionLabel(markingInKindergarten, user?.gender ?? null)}
      onClose={() => setMarking(null)}
      onConfirm={(comment) => {
        if (marking) {
          dispatch(markVisitStart({ childId: marking.child.id, seenStatus: marking.seenStatus, comment }));
        }
        setMarking(null);
      }}
    />
  );

  function confirmLogout() {
    Alert.alert('Выйти из аккаунта?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => dispatch(logoutRequested({ reason: 'user' })),
      },
    ]);
  }

  const isStaff = isStaffRole(user?.role);

  // Android показывает в Alert не больше трёх кнопок. Персонал выходит из профиля или из «Ещё»,
  // поэтому у него вместо «Выйти» — возврат в рабочий режим.
  function openMenu() {
    Alert.alert(`${user?.firstName ?? ''} ${user?.surname ?? ''}`.trim(), undefined, [
      { text: 'Профиль', onPress: () => router.push('/profile') },
      isStaff
        ? {
            text: isAdminRole(user?.role) ? 'Режим администратора' : 'Режим сотрудника',
            onPress: () => {
              dispatch(switchMode('admin'));
              router.replace('/visits');
            },
          }
        : { text: 'Выйти', style: 'destructive', onPress: confirmLogout },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <TouchableOpacity
            onPress={openMenu}
            accessibilityRole="button"
            accessibilityLabel="Меню"
            hitSlop={8}
          >
            <Text style={styles.headerMenu}>⋯</Text>
          </TouchableOpacity>
        ),
      }}
    />
  );

  if (listStatus === 'idle' || listStatus === 'loading') {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator size="large" color={c.primary} />
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
      {markSheet}
      {qrSheet}
      {groupSheet}
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
            onCancel={() => confirmCancel(item)}
            onShowQr={qrAvailable ? () => setQrChildId(item.id) : undefined}
            onShowGroup={() => setGroupChildId(item.id)}
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

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: c.background,
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
      backgroundColor: c.background,
      padding: 20,
    },
    empty: {
      alignItems: 'center',
    },
    message: {
      fontSize: 16,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 16,
    },
    secondaryButton: {
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    secondaryButtonText: {
      color: c.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    headerMenu: {
      color: c.primary,
      fontSize: 24,
      fontWeight: '700',
      paddingHorizontal: 4,
    },
  })
);
