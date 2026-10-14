import { Stack } from 'expo-router';
import React from 'react';
import { brandHeaderTitle } from '@/components/header-brand-title';

/**
 * Стек вкладки «Заявки»: список → заявка.
 */
export default function RequestsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Назад', headerTitle: brandHeaderTitle }}>
      <Stack.Screen name="index" options={{ title: 'Заявки' }} />
      <Stack.Screen name="[id]" options={{ title: 'Заявка' }} />
    </Stack>
  );
}
