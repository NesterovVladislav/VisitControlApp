import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RefreshControl } from '../../../components/ui/refresh-control';
import ChildChangesList from '@/components/child-changes-list';
import ChildRequestsList from '@/components/child-requests-list';
import PhotoRequestsList from '@/components/photo-requests-list';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppDispatch, useAppSelector } from '../../../store';
import { loadChildChanges, loadPendingChildRequests } from '../../../store/reducers/child-requests';
import { loadPendingPhotoRequests } from '../../../store/reducers/photos';
import { loadRequestsStart } from '../../../store/reducers/requests';
import { formatPhone } from '../../../utils/input-masks';
import { plural } from '../../../utils/plural';
import { roleLabel } from '../../../utils/profile-format';
import { fullName, submittedAt } from '../../../utils/registration-request-format';
import { makeStyles, usePalette } from '../../../hooks/use-palette';

/**
 * Вкладка «Заявки»: заявки на регистрацию, ожидающие подтверждения, старые сверху.
 */
export default function RequestsScreen() {
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { items, total, status, refreshing } = useAppSelector((state) => state.requests);
  // Заявки действующих пользователей «добавить мне ребёнка», изменения данных детей и фотографии — блоками
  // над заявками на регистрацию
  const hasChildRequests = useAppSelector(
    (state) =>
      state.childRequests.pending.length + state.childRequests.changes.length + state.photos.pending.length > 0
  );

  // Заявки мог обработать другой администратор, пока вкладка была закрыта
  useFocusEffect(
    useCallback(() => {
      dispatch(loadRequestsStart());
      dispatch(loadPendingChildRequests({ silent: true }));
      dispatch(loadChildChanges());
      dispatch(loadPendingPhotoRequests({ silent: true }));
    }, [dispatch])
  );

  if (status === 'idle' || status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.primary} />
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
      contentContainerStyle={items.length === 0 && !hasChildRequests ? styles.emptyContainer : styles.listContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            dispatch(loadRequestsStart({ refresh: true }));
            dispatch(loadPendingChildRequests({ silent: true }));
            dispatch(loadChildChanges());
            dispatch(loadPendingPhotoRequests({ silent: true }));
          }}
        />
      }
      ListHeaderComponent={
        <>
          <ChildRequestsList />
          <ChildChangesList />
          <PhotoRequestsList />
          {hasChildRequests && items.length > 0 ? <Text style={styles.sectionTitle}>РЕГИСТРАЦИЯ</Text> : null}
          {total > items.length ? (
            <Text style={styles.note}>
              Показаны первые {items.length} из {total}. Обработайте их, чтобы увидеть остальные
            </Text>
          ) : null}
        </>
      }
      renderItem={({ item, index }) => (
        <TouchableOpacity
          style={[styles.row, index === 0 && styles.rowFirst, index === items.length - 1 && styles.rowLast]}
          onPress={() => router.push({ pathname: '/requests/[id]', params: { id: item.id } })}
          accessibilityRole="button"
        >
          <View style={styles.rowText}>
            <Text style={styles.name}>{fullName(item)}</Text>
            <Text style={styles.role}>
              {[
                item.role ? roleLabel(item.role) : null,
                item.children?.length
                  ? `${item.children.length} ${plural(item.children.length, ['ребёнок', 'ребёнка', 'детей'])}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={styles.contacts} numberOfLines={1}>
              {[item.email, item.phone ? formatPhone(item.phone) : null].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.date}>{submittedAt(item.created)}</Text>
          </View>
          <IconSymbol name="chevron.right" size={22} color={c.iconMuted} />
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        hasChildRequests ? null : (
          <View style={styles.empty}>
            <Text style={styles.message}>Новых заявок нет</Text>
          </View>
        )
      }
    />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
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
      backgroundColor: c.background,
      padding: 20,
    },
    empty: {
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: c.textTertiary,
      marginBottom: 8,
      marginLeft: 4,
    },
    note: {
      fontSize: 14,
      color: c.textSecondary,
      marginBottom: 12,
      lineHeight: 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
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
      color: c.text,
    },
    role: {
      marginTop: 2,
      fontSize: 14,
      color: c.primary,
    },
    contacts: {
      marginTop: 4,
      fontSize: 14,
      color: c.textSecondary,
    },
    date: {
      marginTop: 4,
      fontSize: 13,
      color: c.textTertiary,
    },
    message: {
      fontSize: 16,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    retry: {
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    retryText: {
      color: c.primary,
      fontSize: 16,
      fontWeight: '600',
    },
  })
);
