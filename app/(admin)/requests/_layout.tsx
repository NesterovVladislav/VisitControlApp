import { Stack } from 'expo-router';
import React from 'react';

/**
 * Стек вкладки «Заявки»: список → заявка.
 */
export default function RequestsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Назад' }}>
      <Stack.Screen name="index" options={{ title: 'Заявки' }} />
      <Stack.Screen name="[id]" options={{ title: 'Заявка' }} />
    </Stack>
  );
}
