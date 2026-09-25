import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Child, ChildStatus, isInKindergarten } from '../store/types/children';
import { User } from '../store/types/auth';

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
    statusView = <ActivityIndicator size="small" color="#999" style={styles.statusSpinner} />;
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
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{markActionLabel(inKindergarten, gender)}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
    backgroundColor: '#2E7D32',
  },
  dotOut: {
    backgroundColor: '#888',
  },
  statusText: {
    fontSize: 15,
    color: '#888',
  },
  statusTextIn: {
    color: '#2E7D32',
    fontWeight: '500',
  },
  notice: {
    marginTop: 8,
    fontSize: 13,
    color: '#B26A00',
  },
  link: {
    color: '#007AFF',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
