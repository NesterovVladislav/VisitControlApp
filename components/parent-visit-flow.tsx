import { personName } from '@/utils/people-format';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import QrCode from './child-visit-code';

import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { visitControlApi } from '../services/api';
import { Child, ChildStatus, isInKindergarten, VISIT_COMMENT_MAX_LENGTH, VisitStatus } from '../store/types/children';
import { countdownLabel, handoverErrorMessage } from '../utils/handover';
import { ActionButton, BottomSheet, StatusMessage } from './ui';
import { IconSymbol } from './ui/icon-symbol';

export interface ParentVisitFlowProps {
  child: Child;
  seenStatus: VisitStatus;
  status: ChildStatus | undefined;
  qrAvailable: boolean;
  continueQr?: boolean;
  next: Child | null;
  onPoll: (childId: string) => void;
  onNext: (child: Child) => void;
  onConfirm: (comment: string) => void;
  onClose: () => void;
}

type Phase = 'form' | 'issuing' | 'code' | 'done';
const STATUS_POLL_MS = 3_000;

export default function ParentVisitFlow(props: ParentVisitFlowProps) {
  return <VisitSession key={props.child.id} {...props} />;
}

function VisitSession({ child, seenStatus, status, qrAvailable, continueQr = false, next, onPoll, onNext, onConfirm, onClose }: ParentVisitFlowProps) {
  const c = usePalette();
  const styles = useStyles();
  const [phase, setPhase] = useState<Phase>('form');
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const [token, setToken] = useState('');
  const [deadline, setDeadline] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const arriving = !isInKindergarten(seenStatus);
  const known = status?.value != null;
  const directionChanged = known && isInKindergarten(status.value) === arriving;
  const actionable = known && !directionChanged && !status?.visit?.pending;
  const inQr = phase === 'issuing' || phase === 'code';
  const name = personName(child);
  const label = arriving ? 'Кто привёл ребёнка?' : 'Кто забрал ребёнка?';
  const busy = phase === 'issuing';

  useEffect(() => () => { revision.current++; }, []);

  const issue = useCallback(async () => {
    const request = ++revision.current;
    setError(null);
    setPhase('issuing');
    try {
      const issued = await visitControlApi.issueHandover(child.id, arriving ? 'IN' : 'OUT', comment.trim());
      if (request !== revision.current) return;
      setToken(issued.token);
      setDeadline(Date.now() + issued.expiresIn * 1000);
      setSecondsLeft(issued.expiresIn);
      setPhase('code');
    } catch (failure) {
      if (request !== revision.current) return;
      setError(handoverErrorMessage(failure));
      setPhase('form');
      onPoll(child.id);
    }
  }, [child.id, arriving, comment, onPoll]);

  useEffect(() => {
    if (!inQr) return;
    if (directionChanged) {
      revision.current++;
      setPhase('done');
    } else if (!actionable || !qrAvailable) {
      revision.current++;
      setPhase('form');
      setToken('');
    }
  }, [inQr, directionChanged, actionable, qrAvailable]);

  useEffect(() => {
    if (phase !== 'code' || !actionable || !qrAvailable) return;
    const countdown = setInterval(() => {
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(countdown);
        void issue();
      }
    }, 1000);
    const poll = setInterval(() => onPoll(child.id), STATUS_POLL_MS);
    return () => { clearInterval(countdown); clearInterval(poll); };
  }, [phase, deadline, actionable, qrAvailable, issue, onPoll, child.id]);

  function back() {
    if (inQr) {
      revision.current++;
      setToken('');
      setPhase('form');
    } else {
      onClose();
    }
  }

  const title = phase === 'done' ? name : `${arriving ? 'Приход' : 'Уход'} · ${name}`;
  return (
    <BottomSheet title={title} onClose={back} closeLabel={inQr ? 'Назад' : 'Закрыть'}>
      {phase === 'done' ? (
        <>
          <StatusMessage tone="success" message={arriving ? 'Сад принял ребёнка' : 'Сад отдал ребёнка'} />
          {next && <ActionButton label={`Следующий: ${personName(next)} ›`} onPress={() => onNext(next)} />}
          <ActionButton label="Готово" variant={next ? 'text' : 'primary'} onPress={onClose} />
        </>
      ) : phase === 'code' && actionable && qrAvailable ? (
        <>
          <QrCode token={token} />
          <Text style={styles.instruction}>Покажите код сотруднику</Text>
          <Text style={styles.countdown}>Код обновится через {countdownLabel(secondsLeft)}</Text>
          {next && <ActionButton label={`Следующий: ${personName(next)} ›`} variant="text" onPress={() => onNext(next)} />}
        </>
      ) : (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }}
            style={styles.disclosure} onPress={() => setExpanded(!expanded)}>
            <Text style={styles.label}>{label}</Text>
            <IconSymbol name="chevron.down" size={22} color={c.textSecondary}
              style={expanded ? styles.up : undefined} />
          </Pressable>
          {expanded && <>
            <TextInput accessibilityLabel={label} multiline style={styles.field}
            placeholder="Необязательно" placeholderTextColor={c.placeholder} maxLength={VISIT_COMMENT_MAX_LENGTH}
            value={comment} onChangeText={setComment} editable={!busy} />
            <Text style={styles.counter}>{comment.length} / {VISIT_COMMENT_MAX_LENGTH}</Text>
          </>}
          {!actionable ? <StatusMessage message={status?.visit?.pending ? 'Отметка уже ждёт подтверждения' :
            'Статус ребёнка изменился. Вернитесь на главную.'} /> :
            error ? <StatusMessage tone="error" message={error} /> : null}
          {continueQr && !qrAvailable && <StatusMessage message="Показ QR-кода больше недоступен" />}
          {!continueQr && <ActionButton label={qrAvailable ? 'Отправить отметку' : arriving ? 'Отметить приход' : 'Отметить уход'}
            disabled={!actionable || busy} onPress={() => onConfirm(comment.trim())} />}
          {qrAvailable && <ActionButton label="Показать QR-код" variant={continueQr ? 'primary' : 'text'}
            disabled={!actionable} loading={busy} onPress={issue} />}
        </>
      )}
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  disclosure: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: controlHeight.touch },
  label: { flex: 1, color: c.text, fontSize: typeSize.body },
  up: { transform: [{ rotate: '180deg' }] },
  field: { minHeight: 72, borderRadius: radius.control, borderWidth: 1, borderColor: c.border,
    padding: space.md, color: c.text, textAlignVertical: 'top', fontSize: typeSize.body },
  counter: { color: c.textSecondary, fontSize: typeSize.caption, textAlign: 'right' },
  instruction: { color: c.text, fontSize: typeSize.body, textAlign: 'center' },
  countdown: { color: c.textSecondary, fontSize: typeSize.label, textAlign: 'center' },
}));
