import { Stack } from 'expo-router';
import React from 'react';
import { brandHeaderTitle } from '@/components/header-brand-title';

/**
 * Стек вкладки «Люди»: список → карточка человека с действиями.
 */
export default function PeopleLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Назад', headerTitle: brandHeaderTitle }}>
      <Stack.Screen name="index" options={{ title: 'Люди' }} />
      <Stack.Screen name="[id]" options={{ title: 'Карточка' }} />
    </Stack>
  );
}
