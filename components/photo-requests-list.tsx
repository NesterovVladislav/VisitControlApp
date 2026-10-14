import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from './avatar';
import CommentSheet from './comment-sheet';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { useAppDispatch, useAppSelector } from '../store';
import { approvePhotoRequestStart, rejectPhotoRequestStart } from '../store/reducers/photos';
import { PhotoRequest } from '../store/types/photos';

/** Причины отклонения: подставляются в поле одним нажатием, свою можно вписать. */
const REJECT_REASONS = ['Не видно лица', 'На фотографии другой человек', 'Неподходящая фотография'];
const REASON_MAX_LENGTH = 500;
const PHOTO_SIZE = 88;

function names(request: PhotoRequest): { firstName: string; surname: string } {
  const [firstName = '', surname = ''] = request.userName.split(' ');
  return { firstName, surname };
}

/**
 * Фотографии, которые пользователи отправили на подтверждение: свои и своих детей. Рядом действующая
 * фотография и предлагаемая. Администратор подтверждает — фотография заменяется — или отклоняет с причиной.
 */
export default function PhotoRequestsList() {
  const c = usePalette();
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const requests = useAppSelector((state) => state.photos.pending);
  const decidingIds = useAppSelector((state) => state.photos.decidingIds);
  const [rejecting, setRejecting] = useState<PhotoRequest | null>(null);

  if (requests.length === 0) {
    return null;
  }

  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>ФОТОГРАФИИ</Text>
      {requests.map((request) => (
        <View key={request.id} style={styles.card}>
          <Text style={styles.name}>{request.userName}</Text>
          {request.applicantName ? <Text style={styles.applicant}>Отправил(а): {request.applicantName}</Text> : null}
          <View style={styles.photos}>
            <View style={styles.photo}>
              <Avatar {...names(request)} photoUrl={request.currentPhotoUrl} size={PHOTO_SIZE} />
              <Text style={styles.caption}>{request.currentPhotoUrl ? 'Сейчас' : 'Сейчас фото нет'}</Text>
            </View>
            <View style={styles.photo}>
              <Avatar {...names(request)} photoUrl={request.imageUrl} size={PHOTO_SIZE} />
              <Text style={styles.caption}>Предлагается</Text>
            </View>
          </View>
          {decidingIds.includes(request.id) ? (
            <ActivityIndicator style={styles.deciding} color={c.primary} />
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.reject]}
                onPress={() => setRejecting(request)}
                accessibilityRole="button"
                accessibilityLabel={`Отклонить фотографию: ${request.userName}`}
              >
                <Text style={styles.rejectText}>Отклонить</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.approve]}
                onPress={() => dispatch(approvePhotoRequestStart(request.id))}
                accessibilityRole="button"
                accessibilityLabel={`Подтвердить фотографию: ${request.userName}`}
              >
                <Text style={styles.approveText}>Подтвердить</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
      <CommentSheet
        visible={rejecting !== null}
        title={rejecting?.userName ?? ''}
        message="Отклонить фотографию?"
        label="Причина — её увидит тот, кто отправил фотографию"
        maxLength={REASON_MAX_LENGTH}
        presets={REJECT_REASONS}
        required
        destructive
        confirmLabel="Отклонить"
        onClose={() => setRejecting(null)}
        onConfirm={(comment) => {
          if (rejecting) {
            dispatch(rejectPhotoRequestStart({ id: rejecting.id, comment }));
          }
          setRejecting(null);
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    block: {
      marginBottom: 20,
    },
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
      padding: 16,
      marginBottom: 10,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },
    applicant: {
      marginTop: 4,
      fontSize: 13,
      color: c.textSecondary,
    },
    photos: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 14,
    },
    photo: {
      alignItems: 'center',
    },
    caption: {
      marginTop: 6,
      fontSize: 13,
      color: c.textSecondary,
    },
    deciding: {
      marginTop: 12,
      minHeight: 44,
    },
    actions: {
      flexDirection: 'row',
      marginTop: 14,
    },
    button: {
      flex: 1,
      minHeight: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reject: {
      marginRight: 10,
      backgroundColor: c.fill,
    },
    rejectText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.danger,
    },
    approve: {
      backgroundColor: c.primary,
    },
    approveText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.onPrimary,
    },
  })
);
