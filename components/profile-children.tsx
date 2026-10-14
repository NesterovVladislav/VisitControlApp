import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from './avatar';
import { IconSymbol } from './ui/icon-symbol';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { useAppDispatch, useAppSelector } from '../store';
import {
  cancelChildRequestStart,
  clearChildRequestError,
  loadOwnChildren,
  loadOwnChildRequests,
} from '../store/reducers/child-requests';
import { loadChildrenStart } from '../store/reducers/children';
import { ChildRequest } from '../store/types/child-requests';
import { childRequestName, ownChangeLabel, ownRequestStatusLabel } from '../utils/child-requests';

/**
 * «Мои дети» в профиле: дети, привязанные к пользователю (по нажатию — данные ребёнка и их правка),
 * его заявки на добавление ребёнка и кнопка «Добавить ребёнка». Есть у всех, кто состоит в саду: администратор и директор тоже бывают родителями.
 */
export default function ProfileChildren() {
  const c = usePalette();
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const children = useAppSelector((state) => state.children.items);
  const listStatus = useAppSelector((state) => state.children.listStatus);
  const { own, ownChildren, cancellingIds, error } = useAppSelector((state) => state.childRequests);

  // Администратор мог подтвердить заявку, пока профиль был закрыт
  useFocusEffect(
    useCallback(() => {
      dispatch(loadOwnChildRequests());
      dispatch(loadOwnChildren());
      dispatch(loadChildrenStart(listStatus === 'loaded' ? { refresh: true } : undefined));
      // Статус списка нужен только на момент открытия экрана
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch])
  );

  useEffect(() => {
    if (error) {
      Alert.alert('Не получилось', error, [{ text: 'OK', onPress: () => dispatch(clearChildRequestError()) }]);
    }
  }, [error, dispatch]);

  function confirmCancel(request: ChildRequest) {
    Alert.alert(childRequestName(request), 'Отозвать заявку на добавление ребёнка?', [
      { text: 'Нет', style: 'cancel' },
      { text: 'Отозвать', style: 'destructive', onPress: () => dispatch(cancelChildRequestStart(request.id)) },
    ]);
  }

  return (
    <>
      <Text style={styles.sectionTitle}>МОИ ДЕТИ</Text>
      <View style={styles.card}>
        {ownChildren
          ? ownChildren.map((child) => {
              const changeLabel = child.change ? ownChangeLabel(child.change) : null;
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[styles.row, styles.rowBorder]}
                  onPress={() => router.push({ pathname: '/profile/child/[id]', params: { id: child.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Данные ребёнка: ${childRequestName(child)}`}
                >
                  <View style={styles.avatar}>
                    <Avatar firstName={child.firstName} surname={child.surname} photoUrl={child.photoUrl} size={36} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{childRequestName(child)}</Text>
                    {changeLabel ? (
                      <Text
                        style={[styles.status, child.change?.status === 'REJECTED' && styles.statusRejected]}
                        numberOfLines={2}
                      >
                        {changeLabel}
                      </Text>
                    ) : null}
                  </View>
                  <IconSymbol name="chevron.right" size={22} color={c.textTertiary} />
                </TouchableOpacity>
              );
            })
          : // Бэкенд без карточек детей: только имена, без правки
            children.map((child) => (
              <View key={child.id} style={[styles.row, styles.rowBorder]}>
                <Text style={styles.name}>{`${child.surname} ${child.firstName}`.trim()}</Text>
              </View>
            ))}
        {own.map((request) => {
          const cancelling = cancellingIds.includes(request.id);
          return (
            <View key={request.id} style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowText}>
                <Text style={styles.name}>{childRequestName(request)}</Text>
                <Text style={[styles.status, request.status === 'REJECTED' && styles.statusRejected]}>
                  {ownRequestStatusLabel(request)}
                </Text>
              </View>
              {request.status !== 'PENDING' ? null : cancelling ? (
                <ActivityIndicator color={c.textTertiary} />
              ) : (
                <TouchableOpacity
                  onPress={() => confirmCancel(request)}
                  accessibilityRole="button"
                  accessibilityLabel={`Отозвать заявку: ${childRequestName(request)}`}
                  hitSlop={8}
                >
                  <Text style={styles.cancel}>Отозвать</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/profile/add-child')}
          accessibilityRole="button"
        >
          <Text style={styles.action}>Добавить ребёнка</Text>
          <IconSymbol name="chevron.right" size={22} color={c.textTertiary} />
        </TouchableOpacity>
      </View>
    </>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: c.textTertiary,
      marginBottom: 8,
      marginLeft: 4,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 10,
      marginBottom: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    avatar: {
      marginRight: 12,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    rowText: {
      flex: 1,
      marginRight: 12,
    },
    name: {
      fontSize: 16,
      color: c.text,
    },
    status: {
      marginTop: 2,
      fontSize: 13,
      color: c.warning,
    },
    statusRejected: {
      color: c.danger,
    },
    cancel: {
      fontSize: 15,
      color: c.danger,
    },
    action: {
      fontSize: 16,
      color: c.primary,
    },
  })
);
