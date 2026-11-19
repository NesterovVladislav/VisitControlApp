import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RefreshControl } from '../components/ui/refresh-control';
import ChildCard from '../components/child-card';
import ChildAbsence from '../components/child-absence';
import { ChildGroupPanel } from '../components/child-group-sheet';
import { ChildAttendancePanel } from '../components/child-attendance-panel';
import ParentVisitFlow from '../components/parent-visit-flow';
import { ParentChildSelector, ParentSection, ParentSectionBar } from '../components/parent-navigation';
import { hasAttendanceAccess } from '../hooks/use-own-attendance';
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
import { Child, VisitStatus } from '../store/types/children';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { space } from '../constants/ui-tokens';

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

  const [absenceRefresh, setAbsenceRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [section, setSection] = useState<ParentSection>('home');
  const [calendarCursor, setCalendarCursor] = useState<string | null>(null);
  const selected = items.find(child => child.id === selectedId) ?? items[0];
  const showCalendar = Boolean(selected && hasAttendanceAccess(selected));
  const currentSection = section === 'calendar' && !showCalendar ? 'home' : section;
  function selectChild(child: Child) {
    setSelectedId(child.id);
    if (section === 'calendar' && !hasAttendanceAccess(child)) setSection('home');
  }

  useFocusEffect(useCallback(() => {
    if (currentSection === 'home') return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setSection('home');
      return true;
    });
    return () => back.remove();
  }, [currentSection]));
  const attendanceUnavailable = useCallback(() => {
    setSection('home');
    dispatch(loadChildrenStart({ refresh: true }));
  }, [dispatch]);

  function refreshChildren() {
    setAbsenceRefresh((value) => value + 1);
    dispatch(loadChildrenStart({ refresh: true }));
  }

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
  const [marking, setMarking] = useState<{ child: Child; seenStatus: VisitStatus; continueQr: boolean } | null>(null);

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

  function confirmMark(child: Child, continueQr = false) {
    const seenStatus = statusById[child.id]?.value;
    if (!seenStatus) {
      return;
    }
    // Вместо Alert — шторка: в ней есть поле для комментария
    setMarking({ child, seenStatus, continueQr });
  }

  function confirmCancel(child: Child) {
    Alert.alert(`${child.firstName} ${child.surname}`.trim(), 'Отменить отметку? Сад её ещё не подтвердил', [
      { text: 'Нет', style: 'cancel' },
      { text: 'Отменить отметку', style: 'destructive', onPress: () => dispatch(cancelMarkStart(child.id)) },
    ]);
  }

  const markedChild = items.find(child => child.id === marking?.child.id);
  const qrCandidates = items.filter(child => statusById[child.id]?.value != null && !statusById[child.id]?.visit?.pending);
  const qrIndex = qrCandidates.findIndex(child => child.id === markedChild?.id);
  const qrNext = qrCandidates.length > 1 ? qrCandidates[(qrIndex + 1) % qrCandidates.length] : null;
  const pollQrStatus = useCallback((id: string) => dispatch(loadStatusStart(id)), [dispatch]);

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
        title: currentSection === 'calendar' ? 'Календарь' : currentSection === 'group' ? 'Группа' : items.length === 1 ? 'Главная' : 'Мои дети',
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

  if (!selected) return (
    <View style={styles.center}>
      {header}
      <Text style={styles.message}>К вашему аккаунту пока не привязаны дети. Администратор сада добавит их после проверки заявки</Text>
      <TouchableOpacity style={styles.secondaryButton} accessibilityRole="button" onPress={refreshChildren}>
        <Text style={styles.secondaryButtonText}>Обновить</Text>
      </TouchableOpacity>
    </View>
  );

  const status = statusById[selected.id];
  return (
    <View style={styles.screen}>
      {header}
      <ParentChildSelector items={items} statuses={statusById} selected={selected} onSelect={selectChild} />
      {items.length === 1 && currentSection !== 'home' && (
        <Text style={styles.contextName}>{selected.firstName} {selected.surname}</Text>
      )}
      {currentSection === 'calendar' ? (
        <ChildAttendancePanel childId={selected.id} cursor={calendarCursor} onCursorChange={setCalendarCursor} onUnavailable={attendanceUnavailable} />
      ) : currentSection === 'group' ? (
        <ChildGroupPanel key={selected.id} child={selected} />
      ) : (
        <ScrollView contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshChildren} />}>
          <ChildCard key={selected.id} child={selected} status={status} hideIdentity={items.length > 1}
            gender={user?.gender ?? null} marking={markingIds.includes(selected.id)}
            onMark={() => confirmMark(selected)} onCancel={() => confirmCancel(selected)}
            onRetryStatus={() => dispatch(loadStatusStart(selected.id))}
            absenceActions={<ChildAbsence child={selected}
              refresh={`${absenceRefresh}:${status?.visit?.pending?.id ?? status?.visit?.decidedAt ?? status?.value ?? ''}`} />}
          />
        </ScrollView>
      )}
      <ParentSectionBar selected={currentSection} showCalendar={showCalendar} onSelect={setSection} />
      {marking && markedChild && (
        <ParentVisitFlow key={markedChild.id} child={markedChild} seenStatus={marking.seenStatus}
          continueQr={marking.continueQr} status={statusById[markedChild.id]} qrAvailable={qrAvailable} next={qrNext} onPoll={pollQrStatus}
          onNext={child => { selectChild(child); confirmMark(child, true); }}
          onConfirm={comment => {
            dispatch(markVisitStart({ childId: markedChild.id, seenStatus: marking.seenStatus, comment }));
            setMarking(null);
          }}
          onClose={() => setMarking(null)}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.card },
    contextName: { alignSelf: 'center', width: '100%', maxWidth: 480, paddingHorizontal: space.lg,
      paddingTop: space.md, fontSize: 16, fontWeight: '600', color: c.text },
    container: { padding: space.lg, width: '100%', maxWidth: 480, alignSelf: 'center' },
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
