import { Stack } from 'expo-router';
import React from 'react';
import { brandHeaderTitle } from '@/components/header-brand-title';

/**
 * Стек вкладки «Сад» (docs/garden-screen.md): филиалы → филиал → группа; «Дети без группы»;
 * диалог названия и «Состав группы» — модальные.
 */
export default function GardenLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Назад', headerTitle: brandHeaderTitle }}>
      <Stack.Screen name="index" options={{ title: 'Сад' }} />
      <Stack.Screen name="branch/[id]" options={{ title: 'Филиал' }} />
      <Stack.Screen name="group/[id]" options={{ title: 'Группа' }} />
      <Stack.Screen name="without-group" options={{ title: 'Дети без группы' }} />
      <Stack.Screen name="name" options={{ title: '', presentation: 'modal' }} />
      <Stack.Screen name="group-members" options={{ title: 'Состав группы', presentation: 'modal' }} />
    </Stack>
  );
}
