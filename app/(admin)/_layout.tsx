import { Redirect, Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppDispatch, useAppSelector } from '../../store';
import { loadRequestsStart } from '../../store/reducers/requests';
import { ADMIN_ROLE, isStaffRole } from '../../store/types/auth';
import { usePalette } from '../../hooks/use-palette';

/**
 * Рабочий режим персонала, см. docs/admin-screens.md. Администратор видит пять вкладок, сотрудник —
 * только «Посещение» и «Ещё»: он не разбирает заявки, не ведёт сад и не создаёт людей.
 */
export default function AdminLayout() {
  const c = usePalette();
  const dispatch = useAppDispatch();
  const { phase, user, mode } = useAppSelector((state) => state.auth);
  const pendingRequests = useAppSelector((state) => state.requests.total);
  const inWorkMode = phase === 'authenticated' && isStaffRole(user?.role) && mode === 'admin';
  const isAdmin = inWorkMode && user?.role === ADMIN_ROLE;
  // Вкладки только для администратора у сотрудника скрыты: href: null убирает их из панели
  const adminOnly = isAdmin ? {} : { href: null };

  // Заявки грузим сразу, а не при открытии вкладки: число нужно для значка
  useEffect(() => {
    if (isAdmin) {
      dispatch(loadRequestsStart());
    }
  }, [isAdmin, dispatch]);

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
      }}
    >
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Посещение',
          // У вкладки свой стек: список филиалов → филиал
          headerShown: false,
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
        name="people/index"
        options={{
          ...adminOnly,
          title: 'Люди',
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
