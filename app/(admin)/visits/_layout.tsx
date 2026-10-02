import { Stack } from 'expo-router';
import React from 'react';

/**
 * Стек вкладки «Посещение»: кто в саду и журнал → филиал с детьми по группам → состав группы.
 */
export default function VisitsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Назад' }}>
      <Stack.Screen name="index" options={{ title: 'Посещение' }} />
      <Stack.Screen name="branch/[id]" options={{ title: 'Филиал' }} />
      <Stack.Screen name="group-members" options={{ title: 'Состав группы', presentation: 'modal' }} />
    </Stack>
  );
}
