import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppDispatch, useAppSelector } from '../../../store';
import { loadRequestsStart } from '../../../store/reducers/requests';
import { formatPhone } from '../../../utils/input-masks';
import { fullName, submittedAt } from '../../../utils/registration-request-format';

/**
 * Вкладка «Заявки»: заявки на регистрацию, ожидающие подтверждения, старые сверху.
 */
export default function RequestsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { items, total, status, refreshing } = useAppSelector((state) => state.requests);

  // Заявки мог обработать другой администратор, пока вкладка была закрыта
  useFocusEffect(
    useCallback(() => {
      dispatch(loadRequestsStart());
    }, [dispatch])
  );

  if (status === 'idle' || status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Не удалось загрузить заявки</Text>
        <TouchableOpacity style={styles.retry} onPress={() => dispatch(loadRequestsStart())}>
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(request) => request.id}
      contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => dispatch(loadRequestsStart({ refresh: true }))}
        />
      }
      ListHeaderComponent={
        total > items.length ? (
          <Text style={styles.note}>
            Показаны первые {items.length} из {total}. Обработайте их, чтобы увидеть остальные
          </Text>
        ) : null
      }
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={[styles.row, index === 0 && styles.rowFirst, index === items.length - 1 && styles.rowLast]}
          onPress={() => router.push({ pathname: '/requests/[id]', params: { id: item.id } })}
          accessibilityRole="button"
        >
          <View style={styles.rowText}>
            <Text style={styles.name}>{fullName(item)}</Text>
            <Text style={styles.contacts} numberOfLines={1}>
              {[item.email, item.phone ? formatPhone(item.phone) : null].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.date}>{submittedAt(item.created)}</Text>
          </View>
          <IconSymbol name="chevron.right" size={22} color="#bbb" />
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.message}>Новых заявок нет</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 20,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  empty: {
    alignItems: 'center',
  },
  note: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  rowFirst: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  rowLast: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomWidth: 0,
  },
  rowText: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  contacts: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
  date: {
    marginTop: 4,
    fontSize: 13,
    color: '#999',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  retry: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
