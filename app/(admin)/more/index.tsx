import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppDispatch, useAppSelector } from '../../../store';
import { logoutRequested, switchMode } from '../../../store/reducers/auth';

export default function MoreScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const children = useAppSelector((state) => state.children.items);

  function goToParentMode() {
    dispatch(switchMode('parent'));
    router.replace('/children');
  }

  function confirmLogout() {
    Alert.alert('Выйти из аккаунта?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => dispatch(logoutRequested({ reason: 'user' })) },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {/* Переключатель виден, только если у администратора есть свои дети */}
      {children.length > 0 ? (
        <TouchableOpacity
          style={[styles.card, styles.parentMode]}
          onPress={goToParentMode}
          accessibilityRole="button"
          accessibilityLabel="Режим родителя"
        >
          <IconSymbol name="figure.2.and.child.holdinghands" size={28} color="#007AFF" />
          <View style={styles.parentModeText}>
            <Text style={styles.parentModeTitle}>Режим родителя</Text>
            <Text style={styles.parentModeChildren} numberOfLines={1}>
              {children.map((child) => child.firstName).join(', ')}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={22} color="#999" />
        </TouchableOpacity>
      ) : null}

      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={confirmLogout} accessibilityRole="button">
          <Text style={styles.logout}>Выйти</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    padding: 20,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  parentMode: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  parentModeText: {
    flex: 1,
    marginLeft: 14,
  },
  parentModeTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  parentModeChildren: {
    marginTop: 2,
    fontSize: 14,
    color: '#666',
  },
  row: {
    padding: 16,
  },
  logout: {
    fontSize: 16,
    color: '#D32F2F',
  },
});
