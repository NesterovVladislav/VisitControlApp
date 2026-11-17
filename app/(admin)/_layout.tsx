import { Redirect, Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
import { brandHeaderTitle } from '@/components/header-brand-title';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppDispatch, useAppSelector } from '../../store';
import { loadChildChanges, loadPendingChildRequests } from '../../store/reducers/child-requests';
import { loadPendingPhotoRequests } from '../../store/reducers/photos';
import { loadRequestsStart } from '../../store/reducers/requests';
import { loadQueueStart, openQueue } from '../../store/reducers/visit-queue';
import { isAdminRole, isStaffRole } from '../../store/types/auth';
import { usePalette } from '../../hooks/use-palette';

/** Как часто обновлять число ждущих отметок на вкладке «Посещение» */
const QUEUE_BADGE_POLL_MS = 30_000;

/**
 * Рабочий режим персонала, см. docs/admin-screens.md. Администратор видит пять вкладок, сотрудник —
 * только «Посещение» и «Ещё»: он не разбирает заявки, не ведёт сад и не создаёт людей.
 */
export default function AdminLayout() {
  const c = usePalette();
  const dispatch = useAppDispatch();
  const { phase, user, mode } = useAppSelector((state) => state.auth);
  // На значке — заявки на регистрацию, «добавить мне ребёнка», изменения данных детей и фотографии
  const pendingRequests = useAppSelector(
    (state) =>
      state.requests.total +
      state.childRequests.pending.length +
      state.childRequests.changes.length +
      state.photos.pending.length
  );
  const inWorkMode = phase === 'authenticated' && isStaffRole(user?.role) && mode === 'admin';
  const isAdmin = inWorkMode && isAdminRole(user?.role);
  // Вкладки только для администратора у сотрудника скрыты: href: null убирает их из панели
  const adminOnly = isAdmin ? {} : { href: null };

  // Заявки грузим сразу, а не при открытии вкладки: число нужно для значка
  useEffect(() => {
    if (isAdmin) {
      dispatch(loadRequestsStart());
      dispatch(loadPendingChildRequests({ silent: true }));
      dispatch(loadChildChanges());
      dispatch(loadPendingPhotoRequests({ silent: true }));
    }
  }, [isAdmin, dispatch]);

  // Очередь отметок, которые ждут сотрудника: число на вкладке «Посещение». Пушей пока нет, поэтому
  // перечитываем сами, пока приложение на экране
  const queueEnabled = useAppSelector((state) => state.visitQueue.enabled === true);
  const waitingVisits = useAppSelector((state) => state.visitQueue.items.length + state.visitQueue.otherCount);
  useEffect(() => {
    if (inWorkMode) {
      dispatch(openQueue());
    }
  }, [inWorkMode, dispatch]);
  useEffect(() => {
    if (!inWorkMode || !queueEnabled) {
      return undefined;
    }
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        dispatch(loadQueueStart({ silent: true }));
      }
    }, QUEUE_BADGE_POLL_MS);
    return () => clearInterval(timer);
  }, [inWorkMode, queueEnabled, dispatch]);

  if (phase !== 'authenticated') {
    return null;
  }
  if (!inWorkMode) {
    return <Redirect href="/children" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarButton: HapticTab,
        headerTitle: brandHeaderTitle,
      }}
    >
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Посещение',
          // У вкладки свой стек: список филиалов → филиал
          headerShown: false,
          tabBarBadge: queueEnabled && waitingVisits > 0 ? waitingVisits : undefined,
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="checkmark.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          ...adminOnly,
          title: 'Заявки',
          // У вкладки свой стек со своими заголовками
          headerShown: false,
          tabBarBadge: pendingRequests > 0 ? pendingRequests : undefined,
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="envelope.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="garden"
        options={{
          ...adminOnly,
          title: 'Сад',
          // У вкладки свой стек: филиалы → филиал → группа
          headerShown: false,
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="building.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          ...adminOnly,
          title: 'Люди',
          // У вкладки свой стек: список → карточка
          headerShown: false,
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more/index"
        options={{
          title: 'Ещё',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="ellipsis" color={color} />,
        }}
      />
    </Tabs>
  );
}
