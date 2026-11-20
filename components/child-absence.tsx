import { personName } from '@/utils/people-format';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { controlHeight, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { AbsenceNotice, AbsenceRules, getAbsenceRules, shiftAbsenceDay } from '../services/api/absence';
import { ApiError } from '../services/errors/api-error';
import { Child } from '../store/types/children';
import { absenceDateText, absenceRangeText } from './absence-calendar';
import AbsenceSheet from './absence-sheet';
import { ActionButton, StatusMessage } from './ui';
import { IconSymbol } from './ui/icon-symbol';

type SheetTarget = { mode: 'create' } | { mode: 'list'; entry: AbsenceNotice };
type SavedNotice = { message: string; entry?: AbsenceNotice };

type Props = {
  child: Child;
  refresh: string;
  onChanged?: () => void;
};

export default function ChildAbsence(props: Props) {
  return <ChildAbsenceContent key={props.child.id} {...props} />;
}

function ChildAbsenceContent({ child, refresh, onChanged }: Props) {
  const styles = useStyles();
  const colors = usePalette();
  const [rules, setRules] = useState<AbsenceRules | null>(null);
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [success, setSuccess] = useState<SavedNotice | null>(null);
  const [revision, setRevision] = useState(0);

  useFocusEffect(useCallback(() => {
    let request: AbortController | undefined;
    function load() {
      request?.abort();
      const next = new AbortController();
      request = next;
      void getAbsenceRules(child.id, next.signal).then((value) => {
        if (!next.signal.aborted) setRules(value);
      }).catch((error) => {
        if (!next.signal.aborted && error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0)) {
          setTarget(null);
          setSuccess(null);
          setRules(null);
        }
      });
    }
    load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      request?.abort();
      subscription.remove();
    };
    // Отметка посещения и локальная запись меняют серверные действия для ребёнка.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child.id, refresh, revision]));

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 5000);
    return () => clearTimeout(timer);
  }, [success]);

  function refreshCard() {
    setRevision((value) => value + 1);
    onChanged?.();
  }

  function saved(entry: AbsenceNotice, text: string, keepOpen?: boolean) {
    if (!keepOpen) setTarget(null);
    setSuccess({ message: text, entry: entry.status === 'ACTIVE' ? entry : undefined });
    setRules((previous) => previous && ({
      ...previous,
      current: entry.status === 'ACTIVE' && (!previous.current || entry.from <= previous.current.from)
        ? entry
        : previous.current?.external_key === entry.external_key
          ? null
          : previous.current,
    }));
    refreshCard();
  }

  if (!rules) return null;
  const current = success?.entry ?? rules.current;
  const paidDates = current?.paid_days.filter((day) => !day.waived).map((day) => day.date).sort() ?? [];
  const paidDatesText = paidDates.map((date) => absenceDateText(date).slice(0, 5)).join(', ');
  const detailsLabel = current?.editable || current?.cancellable ? 'Изменить' : 'Подробнее';
  const isOneDay = current && current.from === current.to;
  const tomorrow = shiftAbsenceDay(rules.today_date, 1);
  const summaryTitle = !isOneDay ? 'Период отсутствия' : current.from === rules.today_date
    ? 'Сегодня не придёт' : current.from === tomorrow ? 'Завтра не придёт' : 'Запланировано отсутствие';
  const reason = rules.reasons.find(item => item.code === current?.reason)?.name;
  const childName = personName(child);

  return (
    <View style={styles.block}>
      {current && (
        <View style={styles.summary}>
          <Pressable style={styles.summaryHeader} accessibilityRole="button"
            accessibilityLabel={`Отсутствия: ${childName}. ${detailsLabel} ${absenceRangeText(current.from, current.to)}${reason ? '. ' + reason : ''}`}
            onPress={() => setTarget({ mode: 'list', entry: current })}>
            <View style={styles.summaryContent}>
              <Text style={styles.title}>{summaryTitle}</Text>
              <Text style={styles.text}>{absenceRangeText(current.from, current.to)}</Text>
              {reason && <Text style={styles.text}>{reason}</Text>}
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
          </Pressable>
          {paidDates.length > 0 && (
            <Text style={styles.paid} accessibilityLabel={`Оплата за ${paidDates.map(absenceDateText).join(', ')}`}>
              ₽ {paidDatesText} {paidDates.length === 1 ? 'оплачивается' : 'оплачиваются'}
            </Text>
          )}
          {success?.entry && <View style={styles.confirmation} accessibilityLiveRegion="polite" aria-live="polite">
            <Text style={styles.confirmationText}
              accessibilityLabel={`${success.message} · ${absenceRangeText(success.entry.from, success.entry.to)}`}>
              {success.message}
            </Text>
          </View>}
        </View>
      )}
      {success && !success.entry && <StatusMessage message={success.message} tone="success" />}
      {rules.can_report && (
        <ActionButton variant="text" label="Сообщить об отсутствии"
          accessibilityLabel={`Сообщить об отсутствии: ${childName}`}
          onPress={() => setTarget({ mode: 'create' })} />
      )}
      {target && (
        <AbsenceSheet child={child} initialRules={rules} initialMode={target.mode}
          initialEntry={target.mode === 'list' ? target.entry : undefined}
          onClose={() => setTarget(null)} onSaved={saved} onReload={refreshCard} />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  block: { gap: space.sm, marginTop: space.sm },
  summary: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator, paddingVertical: space.sm },
  summaryHeader: { minHeight: controlHeight.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  summaryContent: { flex: 1, gap: space.xxs },
  title: { fontSize: typeSize.body, fontWeight: '700', color: c.text },
  text: { fontSize: typeSize.label, color: c.textSecondary },
  paid: { fontSize: typeSize.caption, color: c.danger },
  confirmation: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator,
    marginTop: space.xs, paddingTop: space.sm },
  confirmationText: { flexShrink: 1, color: c.textSecondary, fontSize: typeSize.caption },
}));
