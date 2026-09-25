import { Redirect, Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppDispatch, useAppSelector } from '../../store';
import { loadRequestsStart } from '../../store/reducers/requests';
import { ADMIN_ROLE } from '../../store/types/auth';

/**
 * Режим администратора: пять вкладок, см. docs/admin-screens.md.
 */
export default function AdminLayout() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const pendingRequests = useAppSelector((state) => state.requests.total);
  const isAdmin = isAuthenticated && user?.role === ADMIN_ROLE;

  // Заявки грузим сразу, а не при открытии вкладки: число нужно для значка
  useEffect(() => {
    if (isAdmin) {
      dispatch(loadRequestsStart());
    }
  }, [isAdmin, dispatch]);

  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }
  if (user?.role !== ADMIN_ROLE) {
    return <Redirect href="/children" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="visits/index"
        options={{
          title: 'Посещение',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="checkmark.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Заявки',
          // У вкладки свой стек со своими заголовками
          headerShown: false,
          tabBarBadge: pendingRequests > 0 ? pendingRequests : undefined,
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="envelope.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="garden/index"
        options={{
          title: 'Сад',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="building.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="people/index"
        options={{
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
