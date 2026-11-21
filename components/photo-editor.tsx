import { personName } from '@/utils/people-format';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ProfileIdentity } from './profile-person';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { PhotoPermissionError, PhotoSource, pickPhoto } from '../services/photos/pick-photo';
import { useAppDispatch, useAppSelector } from '../store';
import {
  cancelPhotoRequestStart,
  clearPhotoError,
  deletePhotoStart,
  loadOwnPhotoRequests,
  submitPhotoStart,
} from '../store/reducers/photos';
import { isAdminRole } from '../store/types/auth';

interface PhotoEditorProps {
  /** Чья фотография */
  userId: string;
  /** Задан — это фотография своего ребёнка, иначе своя */
  childId?: string;
  firstName: string;
  surname: string;
  photoUrl?: string | null;
  /** Свою фотографию меняет сам пользователь, фотографию ребёнка — только родитель */
  canEdit: boolean;
  subtitle?: string;
}



/**
 * Фотография в профиле — своя или своего ребёнка — и её замена: снимок или галерея, удаление, отзыв заявки.
 * Родитель и сотрудник отправляют фотографию на подтверждение сада, до решения остаётся прежняя;
 * администратор и директор меняют сразу. См. visit-control-service/docs/profile-photos.md.
 */
export default function PhotoEditor({ userId, childId, firstName, surname, photoUrl, canEdit, subtitle }: PhotoEditorProps) {
  const c = usePalette();
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const request = useAppSelector((state) => state.photos.own.find((item) => item.userId === userId) ?? null);
  const busy = useAppSelector((state) => state.photos.busyUserIds.includes(userId));
  const cancelling = useAppSelector((state) => (request ? state.photos.cancellingIds.includes(request.id) : false));
  const error = useAppSelector((state) => state.photos.error);
  const immediate = useAppSelector((state) => isAdminRole(state.auth.user?.role ?? ''));
  const pending = request?.status === 'PENDING' ? request : null;
  const target = { userId, childId };

  useEffect(() => {
    dispatch(loadOwnPhotoRequests());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      Alert.alert('Не получилось', error, [{ text: 'OK', onPress: () => dispatch(clearPhotoError()) }]);
    }
  }, [error, dispatch]);

  async function pick(source: PhotoSource) {
    try {
      const uri = await pickPhoto(source);
      if (uri) {
        dispatch(submitPhotoStart({ ...target, uri }));
      }
    } catch (failure) {
      Alert.alert(
        'Не получилось',
        failure instanceof PhotoPermissionError
          ? 'Разрешите приложению доступ к камере в настройках телефона'
          : 'Не удалось открыть фотографию. Попробуйте другой снимок'
      );
    }
  }

  function openMenu() {
    Alert.alert(
      childId ? `Фотография: ${personName({ surname, firstName })}` : 'Фотография профиля',
      immediate ? undefined : 'Новая фотография появится после подтверждения сада',
      [
        { text: 'Сделать снимок', onPress: () => void pick('camera') },
        { text: 'Выбрать из галереи', onPress: () => void pick('library') },
        ...(photoUrl
          ? [
              {
                text: 'Убрать фотографию',
                style: 'destructive' as const,
                onPress: () => dispatch(deletePhotoStart(target)),
              },
            ]
          : []),
        { text: 'Отмена', style: 'cancel' as const },
      ]
    );
  }

  function confirmCancel() {
    if (!pending) return;
    Alert.alert('Отозвать фотографию?', 'Сад её не увидит, останется прежняя', [
      { text: 'Нет', style: 'cancel' },
      { text: 'Отозвать', style: 'destructive', onPress: () => dispatch(cancelPhotoRequestStart(pending.id)) },
    ]);
  }

  return (
    <ProfileIdentity firstName={firstName} surname={surname} photoUrl={pending?.imageUrl ?? photoUrl} subtitle={subtitle}>
      {busy || cancelling ? (
        <ActivityIndicator style={styles.action} color={c.primary} />
      ) : pending ? (
        <>
          <Text style={styles.status}>Ждёт подтверждения сада</Text>
          <TouchableOpacity onPress={confirmCancel} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.cancel}>Отозвать</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {request?.status === 'REJECTED' ? (
            <Text style={[styles.status, styles.rejected]}>
              {request.reason ? `Сад отклонил фотографию: ${request.reason}` : 'Сад отклонил фотографию'}
            </Text>
          ) : null}
          {canEdit ? (
            <TouchableOpacity style={styles.action} onPress={openMenu} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>{photoUrl ? 'Изменить фотографию' : 'Добавить фотографию'}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </ProfileIdentity>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    action: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
    link: {
      fontSize: 15,
      fontWeight: '500',
      color: c.primary,
    },
    status: {
      marginTop: 12,
      fontSize: 14,
      color: c.textSecondary,
      textAlign: 'left',
    },
    rejected: {
      color: c.danger,
    },
    cancel: {
      marginTop: 8,
      fontSize: 15,
      fontWeight: '500',
      color: c.danger,
    },
  })
);
