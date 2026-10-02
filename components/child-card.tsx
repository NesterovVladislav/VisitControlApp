import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Child, ChildStatus, isInKindergarten } from '../store/types/children';
import { User } from '../store/types/auth';
import { makeStyles, usePalette } from '../hooks/use-palette';

interface ChildCardProps {
  child: Child;
  status: ChildStatus | undefined;
  gender: User['gender'];
  marking: boolean;
  onMark: () => void;
  onRetryStatus: () => void;
}

/** Текст кнопки согласуется с полом пользователя, без пола — нейтральный. */
export function markActionLabel(inKindergarten: boolean, gender: User['gender']): string {
  if (gender === 'FEMALE') {
    return inKindergarten ? 'Забрала из сада' : 'Привела в сад';
  }
  if (gender === 'MALE') {
    return inKindergarten ? 'Забрал из сада' : 'Привёл в сад';
  }
  return inKindergarten ? 'Отметить уход' : 'Отметить приход';
}

/**
 * Карточка ребёнка: имя, статус «в саду / не в саду» и кнопка противоположного действия.
 */
export default function ChildCard({
  child,
  status,
  gender,
  marking,
  onMark,
  onRetryStatus,
}: ChildCardProps) {
  const c = usePalette();
  const styles = useStyles();
  const value = status?.value ?? null;
  const known = value !== null;
  const inKindergarten = isInKindergarten(value);
  const name = `${child.firstName} ${child.surname}`.trim();
  const disabled = !known || marking;

  let statusView: React.ReactNode;
  if (status?.error && !known) {
    statusView = (
      <Text style={styles.statusText}>
        Статус неизвестен ·{' '}
        <Text style={styles.link} onPress={onRetryStatus} accessibilityRole="link">
          Повторить
        </Text>
      </Text>
    );
  } else if (!known) {
    statusView = <ActivityIndicator size="small" color={c.textTertiary} style={styles.statusSpinner} />;
  } else {
    statusView = (
      <View style={styles.statusRow}>
        <View style={[styles.dot, inKindergarten ? styles.dotIn : styles.dotOut]} />
        <Text style={[styles.statusText, inKindergarten && styles.statusTextIn]}>
          {inKindergarten ? 'В саду' : 'Не в саду'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{name}</Text>
      <View style={styles.status}>{statusView}</View>
      {status?.notice ? <Text style={styles.notice}>{status.notice}</Text> : null}
      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={onMark}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${markActionLabel(inKindergarten, gender)}: ${name}`}
        accessibilityState={{ disabled, busy: marking }}
      >
        {marking ? (
          <ActivityIndicator color={c.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>{markActionLabel(inKindergarten, gender)}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 20,
      marginBottom: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    name: {
      fontSize: 18,
      fontWeight: '600',
      color: c.text,
    },
    status: {
      marginTop: 8,
      minHeight: 20,
      justifyContent: 'center',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusSpinner: {
      alignSelf: 'flex-start',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 8,
    },
    dotIn: {
      backgroundColor: c.success,
    },
    dotOut: {
      backgroundColor: c.textTertiary,
    },
    statusText: {
      fontSize: 15,
      color: c.textTertiary,
    },
    statusTextIn: {
      color: c.success,
      fontWeight: '500',
    },
    notice: {
      marginTop: 8,
      fontSize: 13,
      color: c.warning,
    },
    link: {
      color: c.primary,
      fontWeight: '500',
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      minHeight: 48,
    },
    buttonDisabled: {
      backgroundColor: c.disabled,
    },
    buttonText: {
      color: c.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  })
);
