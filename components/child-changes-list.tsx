import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CommentSheet from './comment-sheet';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { useAppDispatch, useAppSelector } from '../store';
import { approveChildChangeStart, rejectChildChangeStart } from '../store/reducers/child-requests';
import { ChildChange } from '../store/types/child-requests';
import { changeDiff, childRequestName } from '../utils/child-requests';

/** Причины отклонения: подставляются в поле одним нажатием, свою можно вписать. */
const REJECT_REASONS = ['Нужен документ', 'Данные указаны неверно'];
const REASON_MAX_LENGTH = 500;

/**
 * Изменения данных детей, которые родители отправили на подтверждение: что было, что предлагается, кто
 * предложил. Администратор подтверждает — данные ребёнка меняются — или отклоняет с причиной.
 */
export default function ChildChangesList() {
  const c = usePalette();
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const changes = useAppSelector((state) => state.childRequests.changes);
  const decidingIds = useAppSelector((state) => state.childRequests.decidingChangeIds);
  const [rejecting, setRejecting] = useState<ChildChange | null>(null);

  if (changes.length === 0) {
    return null;
  }

  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>ИЗМЕНЕНИЕ ДАННЫХ ДЕТЕЙ</Text>
      {changes.map((change) => {
        const name = childRequestName(change.previous);
        return (
          <View key={change.id} style={styles.card}>
            <Text style={styles.name}>{name}</Text>
            {changeDiff(change).map((line) => (
              <Text key={line} style={styles.diff}>
                {line}
              </Text>
            ))}
            {change.applicantName ? <Text style={styles.applicant}>Предложил(а): {change.applicantName}</Text> : null}
            {decidingIds.includes(change.id) ? (
              <ActivityIndicator style={styles.deciding} color={c.primary} />
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.reject]}
                  onPress={() => setRejecting(change)}
                  accessibilityRole="button"
                  accessibilityLabel={`Отклонить изменение: ${name}`}
                >
                  <Text style={styles.rejectText}>Отклонить</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.approve]}
                  onPress={() => dispatch(approveChildChangeStart(change.id))}
                  accessibilityRole="button"
                  accessibilityLabel={`Подтвердить изменение: ${name}`}
                >
                  <Text style={styles.approveText}>Подтвердить</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
      <CommentSheet
        visible={rejecting !== null}
        title={rejecting ? childRequestName(rejecting.previous) : ''}
        message="Отклонить изменение данных?"
        label="Причина — её увидит родитель"
        maxLength={REASON_MAX_LENGTH}
        presets={REJECT_REASONS}
        required
        destructive
        confirmLabel="Отклонить"
        onClose={() => setRejecting(null)}
        onConfirm={(comment) => {
          if (rejecting) {
            dispatch(rejectChildChangeStart({ id: rejecting.id, comment }));
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
      marginBottom: 4,
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },
    diff: {
      fontSize: 14,
      lineHeight: 20,
      color: c.text,
    },
    applicant: {
      marginTop: 4,
      fontSize: 13,
      color: c.textSecondary,
    },
    deciding: {
      marginTop: 12,
      minHeight: 44,
    },
    actions: {
      flexDirection: 'row',
      marginTop: 12,
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
