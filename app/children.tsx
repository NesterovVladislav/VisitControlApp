import { personName } from '@/utils/people-format';
import { useFocusEffect } from '@react-navigation/native';
import { Stack } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import ParentAccount from '../components/parent-account';
import { RefreshControl } from '../components/ui/refresh-control';
import ChildCard from '../components/child-card';
import ChildAbsence from '../components/child-absence';
import { ChildGroupPanel } from '../components/child-group-sheet';
import { ChildAttendancePanel } from '../components/child-attendance-panel';
import ParentVisitFlow from '../components/parent-visit-flow';
import { ParentChildSelector, ParentSection, ParentSectionBar } from '../components/parent-navigation';
import { hasAttendanceAccess } from '../hooks/use-own-attendance';
import { useAppDispatch, useAppSelector } from '../store';
import {
  cancelMarkStart,
  clearMarkError,
  loadChildrenStart,
  loadStatusStart,
  markVisitStart,
  refreshStatuses,
} from '../store/reducers/children';
import { Child, VisitStatus } from '../store/types/children';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { space } from '../constants/ui-tokens';

/** Как часто перечитывать статусы, пока отметка ждёт подтверждения сада */
const PENDING_POLL_MS = 12_000;

export default function ChildrenScreen() {
  const c = usePalette();
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { items, listStatus, refreshing, statusById, markingIds, markError, qrAvailable } = useAppSelector(
    (state) => state.children
  );

  const [absenceRefresh, setAbsenceRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [section, setSection] = useState<ParentSection>('home');
  const [unavailableCalendar, setUnavailableCalendar] = useState<string | null>(null);
  const [calendarCursor, setCalendarCursor] = useState<string | null>(null);
  const selected = items.find(child => child.id === selectedId) ?? items[0];
  const showCalendar = Boolean(selected && hasAttendanceAccess(selected) && selected.id !== unavailableCalendar);
  const currentSection = (section === 'calendar' && !showCalendar) || (section === 'group' && !selected) ? 'home' : section;
  function selectChild(child: Child) {
    setSelectedId(child.id);
    if (section === 'calendar' && (!hasAttendanceAccess(child) || child.id === unavailableCalendar)) setSection('home');
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
    setUnavailableCalendar(selected?.id ?? null);
    setSection('home');
    dispatch(loadChildrenStart({ refresh: true }));
  }, [dispatch, selected?.id]);

  function refreshChildren() {
    setUnavailableCalendar(null);
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
        setUnavailableCalendar(null);
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
    Alert.alert(personName(child), 'Отменить отметку? Сад её ещё не подтвердил', [
      { text: 'Нет', style: 'cancel' },
      { text: 'Отменить отметку', style: 'destructive', onPress: () => dispatch(cancelMarkStart(child.id)) },
    ]);
  }

  const markedChild = items.find(child => child.id === marking?.child.id);
  const qrCandidates = items.filter(child => statusById[child.id]?.value != null && !statusById[child.id]?.visit?.pending);
  const qrIndex = qrCandidates.findIndex(child => child.id === markedChild?.id);
  const qrNext = qrCandidates.length > 1 ? qrCandidates[(qrIndex + 1) % qrCandidates.length] : null;
  const pollQrStatus = useCallback((id: string) => dispatch(loadStatusStart(id)), [dispatch]);

  const header = (
    <Stack.Screen options={{
      headerShown: currentSection === 'home' || currentSection === 'group',
      title: currentSection === 'calendar' ? 'Календарь' : currentSection === 'group' ? 'Группа' : 'Главная',
    }} />
  );
  const navigation = <ParentSectionBar selected={currentSection} showCalendar={showCalendar}
    showGroup={Boolean(selected)} onSelect={setSection} />;

  if (currentSection === 'profile') return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {header}
      <ParentAccount />
      {navigation}
    </SafeAreaView>
  );

  if (!selected || listStatus !== 'loaded') return (
    <View style={styles.screen}>
      {header}
      <View style={styles.center}>
        {listStatus === 'loading' || listStatus === 'idle' ? <ActivityIndicator size="large" color={c.primary} /> :
          listStatus === 'failed' ? <>
            <Text style={styles.message}>Не удалось загрузить данные</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => dispatch(loadChildrenStart())}>
              <Text style={styles.secondaryButtonText}>Повторить</Text>
            </TouchableOpacity>
          </> : <>
            <Text style={styles.message}>К вашему аккаунту пока не привязаны дети. Администратор сада добавит их после проверки заявки</Text>
            <TouchableOpacity style={styles.secondaryButton} accessibilityRole="button" onPress={refreshChildren}>
              <Text style={styles.secondaryButtonText}>Обновить</Text>
            </TouchableOpacity>
          </>}
      </View>
      {navigation}
    </View>
  );

  const status = statusById[selected.id];
  return (
    <SafeAreaView edges={currentSection === 'calendar' ? ['top'] : []} style={styles.screen}>
      {header}
      <ParentChildSelector items={items} statuses={statusById} selected={selected} onSelect={selectChild} />
      {currentSection === 'calendar' ? (
        <ChildAttendancePanel key={selected.id} embedded showIdentity={items.length === 1} selected={selected} childId={selected.id} cursor={calendarCursor} onCursorChange={setCalendarCursor} onUnavailable={attendanceUnavailable} />
      ) : currentSection === 'group' ? (
        <ChildGroupPanel key={selected.id} child={selected} />
      ) : (
        <ScrollView contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshChildren} />}>
          <ChildCard key={selected.id} child={selected} status={status} hideIdentity={items.length > 1}
            gender={user?.gender ?? null} marking={markingIds.includes(selected.id)}
            onMark={() => confirmMark(selected)} onCancel={() => confirmCancel(selected)}
            onRetryStatus={() => dispatch(loadStatusStart(selected.id))}
          />
          <ChildAbsence child={selected} calendarAvailable={showCalendar}
            refresh={`${absenceRefresh}:${status?.visit?.pending?.id ?? status?.visit?.decidedAt ?? status?.value ?? ''}`} />
        </ScrollView>
      )}
      {navigation}
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
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    container: { padding: space.md, gap: space.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
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
  })
);
