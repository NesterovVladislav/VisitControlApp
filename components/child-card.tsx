import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { timeOfDay } from '../utils/visit-dates';

interface ChildCardProps {
  child: Child;
  status: ChildStatus | undefined;
  gender: User['gender'];
  marking: boolean;
  onMark: () => void;
  /** Отменить отметку, которая ждёт подтверждения сада */
  onCancel: () => void;
  /** Показать QR-код ребёнка сотруднику сада; нет — в саду не включено подтверждение посещений */
  onShowQr?: () => void;
  /** Показать группу ребёнка: кто в ней и кто сейчас в саду */
  onShowGroup?: () => void;
  onRetryStatus: () => void;
}

/** Подпись поля комментария к отметке: зависит от того, приход отмечают или уход. */
export function commentLabel(inKindergarten: boolean): string {
  return inKindergarten
    ? 'Если ребёнка забрали не лично Вы, укажите данные представителя'
    : 'Если ребёнка привели не лично Вы, укажите данные представителя';
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
  onShowQr,
  onShowGroup,
  onRetryStatus,
}: ChildCardProps) {
  const c = usePalette();
  const styles = useStyles();
  const value = status?.value ?? null;
  const known = value !== null;
  const inKindergarten = isInKindergarten(value);
  const name = `${child.firstName} ${child.surname}`.trim();
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
      <View style={styles.header}>
        <Avatar firstName={child.firstName} surname={child.surname} photoUrl={child.photoUrl} size={48} />
        <Text style={[styles.name, styles.headerName]}>{name}</Text>
      </View>
      <View style={styles.status}>{statusView}</View>
      {pending ? <Text style={styles.detail}>отмечено в {timeOfDay(pending.datetime)}</Text> : null}
      {decided ? <Text style={styles.detail}>{decided}</Text> : null}
      {visit?.rejected && !pending ? <Text style={styles.notice}>{rejectedLabel(visit.rejected)}</Text> : null}
      {status?.notice ? <Text style={styles.notice}>{status.notice}</Text> : null}
      <TouchableOpacity
        style={[styles.button, pending && styles.buttonSecondary, disabled && styles.buttonDisabled]}
        onPress={pending ? onCancel : onMark}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel}: ${name}`}
        accessibilityState={{ disabled, busy: marking }}
      >
        {marking ? (
          <ActivityIndicator color={pending ? c.primary : c.onPrimary} />
        ) : (
          <Text style={[styles.buttonText, pending && !disabled && styles.buttonSecondaryText]}>{actionLabel}</Text>
        )}
      </TouchableOpacity>
      {onShowQr && known && !pending ? (
        <TouchableOpacity
          style={styles.qrButton}
          onPress={onShowQr}
          disabled={marking}
          accessibilityRole="button"
          accessibilityLabel={`Показать QR-код: ${name}`}
        >
          <Text style={styles.qrButtonText}>Показать QR-код сотруднику</Text>
        </TouchableOpacity>
      ) : null}
      {onShowGroup ? (
        <TouchableOpacity
          style={styles.qrButton}
          onPress={onShowGroup}
          accessibilityRole="button"
          accessibilityLabel={`Группа: ${name}`}
        >
          <Text style={styles.qrButtonText}>Кто в группе</Text>
        </TouchableOpacity>
      ) : null}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerName: {
      flex: 1,
      marginLeft: 12,
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
    button: {
      backgroundColor: c.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      minHeight: 48,
    },
    buttonSecondary: {
      backgroundColor: c.fill,
    },
    qrButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      marginTop: 8,
    },
    qrButtonText: {
      color: c.primary,
      fontSize: 15,
      fontWeight: '500',
    },
    buttonSecondaryText: {
      color: c.primary,
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
