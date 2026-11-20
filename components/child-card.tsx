import { personName } from '@/utils/people-format';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  Child,
  ChildStatus,
  ChildVisit,
  isInKindergarten,
  PendingMark,
  RejectedMark,
} from '../store/types/children';
import Avatar from './avatar';
import { User } from '../store/types/auth';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { ActionButton } from './ui';
import { space, typeSize } from '../constants/ui-tokens';
import { timeOfDay } from '../utils/visit-dates';

interface ChildCardProps {
  child: Child;
  status: ChildStatus | undefined;
  gender: User['gender'];
  marking: boolean;
  onMark: () => void;
  /** Отменить отметку, которая ждёт подтверждения сада */
  onCancel: () => void;
  hideIdentity?: boolean;
  onRetryStatus: () => void;
  absenceActions?: React.ReactNode;
}

/** «Ждёт приёма в саду» / «В саду, ждёт выдачи» — пока сотрудник не подтвердил отметку. */
export function pendingLabel(pending: PendingMark): string {
  return pending.status === 'IN' ? 'Ждёт приёма в саду' : 'В саду, ждёт выдачи';
}

/** «принял(а) Петрова О. в 08:42» — пол сотрудника сервер не отдаёт. */
export function decidedLabel(visit: ChildVisit): string | null {
  if (!visit.decidedBy || visit.status === 'NONE') {
    return null;
  }
  const verb = visit.status === 'IN' ? 'принял(а)' : 'отдал(а)';
  const time = visit.decidedAt ? ` в ${timeOfDay(visit.decidedAt)}` : '';
  return `${verb} ${visit.decidedBy}${time}`;
}

/** «Сад не подтвердил приход: «Ребёнка нет»» */
export function rejectedLabel(rejected: RejectedMark): string {
  const what = rejected.status === 'IN' ? 'приход' : 'уход';
  return rejected.reason ? `Сад не подтвердил ${what}: «${rejected.reason}»` : `Сад не подтвердил ${what}`;
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
 * Если отметка ждёт подтверждения сада — статус ожидания и кнопка «Отменить».
 */
export default function ChildCard({
  child,
  status,
  gender,
  marking,
  onMark,
  onCancel,
  hideIdentity = false,
  onRetryStatus,
  absenceActions,
}: ChildCardProps) {
  const c = usePalette();
  const styles = useStyles();
  const value = status?.value ?? null;
  const known = value !== null;
  const inKindergarten = isInKindergarten(value);
  const name = personName(child);
  const disabled = !known || marking;
  const visit = status?.visit ?? null;
  const pending = visit?.pending ?? null;
  const decided = visit && !pending ? decidedLabel(visit) : null;

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
  } else if (pending) {
    statusView = (
      <View style={styles.statusRow}>
        <View style={[styles.dot, styles.dotPending]} />
        <Text style={[styles.statusText, styles.statusTextPending]}>{pendingLabel(pending)}</Text>
      </View>
    );
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

  const actionLabel = pending ? 'Отменить' : markActionLabel(inKindergarten, gender);

  return (
    <View style={styles.card}>
      {!hideIdentity && <View style={styles.header}>
        <Avatar firstName={child.firstName} surname={child.surname} photoUrl={child.photoUrl} size={48} />
        <Text style={[styles.name, styles.headerName]}>{name}</Text>
      </View>}
      {(!hideIdentity || !known) && <View style={styles.status}>{statusView}</View>}
      {pending ? <Text style={styles.detail}>отмечено в {timeOfDay(pending.datetime)}</Text> : null}
      {decided ? <Text style={styles.detail}>{decided}</Text> : null}
      {visit?.rejected && !pending ? <Text style={styles.notice}>{rejectedLabel(visit.rejected)}</Text> : null}
      {status?.notice ? <Text style={styles.notice}>{status.notice}</Text> : null}
      <ActionButton label={actionLabel} accessibilityLabel={`${actionLabel}: ${name}`}
        variant={pending ? 'text' : 'primary'} onPress={pending ? onCancel : onMark}
        disabled={disabled} loading={marking} />
      {absenceActions}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { gap: space.md, paddingVertical: space.sm },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerName: {
      flex: 1,
      marginLeft: 12,
    },
    name: {
      fontSize: typeSize.title,
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
    dotPending: {
      backgroundColor: c.warning,
    },
    statusTextPending: {
      color: c.warning,
      fontWeight: '500',
    },
    detail: {
      marginTop: 4,
      marginLeft: 18,
      fontSize: 13,
      color: c.textTertiary,
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
  })
);
