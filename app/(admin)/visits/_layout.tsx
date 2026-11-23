import { Stack } from 'expo-router';
import React from 'react';
import { renderProfilePageHeader } from '@/components/profile-page-header';

/**
 * Стек вкладки «Посещение»: кто в саду и журнал → филиал с детьми по группам → состав группы.
 */
export default function VisitsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Назад', header: renderProfilePageHeader }}>
      <Stack.Screen name="index" options={{ title: 'Посещение' }} />
      <Stack.Screen name="absences" options={{ title: 'Кого не будет' }} />
      <Stack.Screen name="branch/[id]" options={{ title: 'Филиал' }} />
      <Stack.Screen name="group-members" options={{ title: 'Состав группы', presentation: 'modal' }} />
    </Stack>
  );
}
