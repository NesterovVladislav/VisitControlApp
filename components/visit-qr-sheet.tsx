import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { commentLabel } from './child-card';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { visitControlApi } from '../services/api';
import { Child, isInKindergarten, VISIT_COMMENT_MAX_LENGTH, VisitStatus } from '../store/types/children';
import { countdownLabel, handoverErrorMessage } from '../utils/handover';

/** Как часто проверять, отсканировал ли сотрудник код */
const STATUS_POLL_MS = 3_000;
const QR_SIZE = 260;

interface VisitQrSheetProps {
  /** Ребёнок, чей код показываем; null — шторка закрыта */
  child: Child | null;
  /** Текущий статус ребёнка из стора: по нему видно, что сотрудник отсканировал код */
  status: VisitStatus | null;
  /** Следующий ребёнок, которому тоже можно показать код, или null */
  next: Child | null;
  /** Перечитать статус ребёнка */
  onPoll: (childId: string) => void;
  onNext: (child: Child) => void;
  onClose: () => void;
}

type Phase = 'comment' | 'loading' | 'code' | 'done';

/**
 * QR-код ребёнка для сотрудника сада: у каждого ребёнка свой код. Сначала необязательный комментарий, затем
 * одноразовый код на полторы минуты — он обновляется сам, пока сотрудник его не отсканирует.
 */
export default function VisitQrSheet({ child, status, next, onPoll, onNext, onClose }: VisitQrSheetProps) {
  const c = usePalette();
  const styles = useStyles();
  const [phase, setPhase] = useState<Phase>('comment');
  const [comment, setComment] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Направление фиксируем при открытии: после скана статус в сторе сменится
  const [arriving, setArriving] = useState(true);
  const requestId = useRef(0);

  const childId = child?.id ?? null;
  useEffect(() => {
    requestId.current += 1;
    setPhase('comment');
    setComment('');
    setToken(null);
    setError(null);
    setArriving(!isInKindergarten(status));
    // Статус нужен только на момент открытия кода этого ребёнка
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  const issue = useCallback(async () => {
    if (!childId) {
      return;
    }
    const current = ++requestId.current;
    setError(null);
    setPhase((previous) => (previous === 'code' ? 'code' : 'loading'));
    try {
      const issued = await visitControlApi.issueHandover(childId, arriving ? 'IN' : 'OUT', comment);
      if (current !== requestId.current) {
        return;
      }
      setToken(issued.token);
      setDeadline(Date.now() + issued.expiresIn * 1000);
      setSecondsLeft(issued.expiresIn);
      setPhase('code');
    } catch (issueError) {
      if (current !== requestId.current) {
        return;
      }
      setToken(null);
      setError(handoverErrorMessage(issueError));
      setPhase('comment');
    }
  }, [childId, arriving, comment]);

  // Обратный отсчёт; по истечении срока код обновляется сам
  useEffect(() => {
    if (phase !== 'code') {
      return undefined;
    }
    const timer = setInterval(() => {
      const left = (deadline - Date.now()) / 1000;
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(timer);
        issue();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, deadline, issue]);

  // Пока код на экране, проверяем статус: сотрудник отсканировал — ребёнок принят или отдан
  useEffect(() => {
    if (phase !== 'code' || !childId) {
      return undefined;
    }
    const timer = setInterval(() => onPoll(childId), STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [phase, childId, onPoll]);

  useEffect(() => {
    if (phase === 'code' && status !== null && isInKindergarten(status) === arriving) {
      requestId.current += 1;
      setPhase('done');
    }
  }, [phase, status, arriving]);

  if (!child) {
    return null;
  }
  const name = `${child.firstName} ${child.surname}`.trim();

  let body: React.ReactNode;
  if (phase === 'done') {
    body = (
      <View style={styles.center}>
        <Text style={styles.doneMark}>✓</Text>
        <Text style={styles.doneText}>{arriving ? 'Сад принял ребёнка' : 'Сад отдал ребёнка'}</Text>
        {next ? (
          <TouchableOpacity style={styles.primary} onPress={() => onNext(next)} accessibilityRole="button">
            <Text style={styles.primaryText}>Следующий: {next.firstName} ›</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={next ? styles.secondary : styles.primary} onPress={onClose} accessibilityRole="button">
          <Text style={next ? styles.secondaryText : styles.primaryText}>Готово</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (phase === 'code' && token) {
    body = (
      <View style={styles.center}>
        <QrCode token={token} />
        <Text style={styles.hint}>Покажите код сотруднику сада</Text>
        <Text style={styles.countdown} accessibilityLabel={`Код действует ещё ${Math.ceil(secondsLeft)} секунд`}>
          Код обновится через {countdownLabel(secondsLeft)}
        </Text>
        {next ? (
          <TouchableOpacity style={styles.secondary} onPress={() => onNext(next)} accessibilityRole="button">
            <Text style={styles.secondaryText}>Следующий: {next.firstName} ›</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  } else {
    const loading = phase === 'loading';
    body = (
      <View>
        <Text style={styles.label}>{commentLabel(!arriving)}</Text>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder="Необязательно"
          placeholderTextColor={c.placeholder}
          maxLength={VISIT_COMMENT_MAX_LENGTH}
          multiline
          editable={!loading}
          accessibilityLabel={commentLabel(!arriving)}
        />
        <Text style={styles.counter}>
          {comment.length} / {VISIT_COMMENT_MAX_LENGTH}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.primary, loading && styles.disabled]}
          onPress={issue}
          disabled={loading}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          {loading ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.primaryText}>Показать QR-код</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      {/* На Android с edgeToEdgeEnabled система не сжимает окно под клавиатуру, поэтому padding нужен и там. */}
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{name}</Text>
            <Text style={styles.direction}>{arriving ? 'Привожу в сад' : 'Забираю из сада'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.close}>Закрыть</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Сам код. Пока он на экране, экран не гаснет и светит на полную яркость: так его легче отсканировать.
 * Фон всегда белый, даже в тёмной теме.
 */
function QrCode({ token }: { token: string }) {
  const styles = useStyles();
  useKeepAwake();

  useEffect(() => {
    let previous: number | null = null;
    let cancelled = false;
    (async () => {
      try {
        previous = await Brightness.getBrightnessAsync();
        if (!cancelled) {
          await Brightness.setBrightnessAsync(1);
        }
      } catch {
        // Яркость — удобство, а не условие: код остаётся на экране
      }
    })();
    return () => {
      cancelled = true;
      const restore =
        Platform.OS === 'android'
          ? Brightness.restoreSystemBrightnessAsync()
          : previous === null
            ? Promise.resolve()
            : Brightness.setBrightnessAsync(previous);
      restore.catch(() => {});
    };
  }, []);

  return (
    <View style={styles.qrBox} accessibilityLabel="QR-код ребёнка">
      <QRCode value={token} size={QR_SIZE} backgroundColor="#fff" color="#000" />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 28,
      paddingBottom: 12,
    },
    headerText: {
      flex: 1,
      marginRight: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: c.text,
    },
    direction: {
      marginTop: 4,
      fontSize: 16,
      color: c.textSecondary,
    },
    close: {
      fontSize: 16,
      color: c.primary,
    },
    content: {
      padding: 20,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    center: {
      alignItems: 'center',
    },
    qrBox: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: '#fff',
    },
    hint: {
      marginTop: 20,
      fontSize: 16,
      color: c.text,
      textAlign: 'center',
    },
    countdown: {
      marginTop: 6,
      marginBottom: 16,
      fontSize: 14,
      color: c.textTertiary,
    },
    label: {
      marginBottom: 8,
      fontSize: 14,
      lineHeight: 19,
      color: c.textSecondary,
    },
    input: {
      minHeight: 72,
      maxHeight: 140,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.card,
      textAlignVertical: 'top',
    },
    counter: {
      marginTop: 4,
      fontSize: 12,
      color: c.textTertiary,
      textAlign: 'right',
    },
    error: {
      marginTop: 12,
      fontSize: 14,
      lineHeight: 19,
      color: c.danger,
    },
    primary: {
      alignSelf: 'stretch',
      minHeight: 48,
      marginTop: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      backgroundColor: c.primary,
    },
    primaryText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.onPrimary,
    },
    secondary: {
      alignSelf: 'stretch',
      minHeight: 48,
      marginTop: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      backgroundColor: c.fill,
    },
    secondaryText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.primary,
    },
    disabled: {
      backgroundColor: c.disabled,
    },
    doneMark: {
      fontSize: 64,
      color: c.success,
    },
    doneText: {
      marginTop: 8,
      marginBottom: 8,
      fontSize: 18,
      fontWeight: '600',
      color: c.text,
    },
  })
);
