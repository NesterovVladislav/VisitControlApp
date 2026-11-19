import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import {
  AbsenceNotice, AbsenceOption, AbsenceRules, absenceDayDistance, absencePaidDates, shiftAbsenceDay,
  cancelAbsence, createAbsence, getAbsenceRules, getChildAbsences, updateAbsence,
} from '../services/api/absence';
import { ApiError } from '../services/errors/api-error';
import { Child } from '../store/types/children';
import AbsenceCalendar, { absenceDateText, absenceRangeText } from './absence-calendar';
import AbsencePeriodPicker from './absence-period-picker';
import { ActionButton, BottomSheet, FormField, StatusMessage } from './ui';
import { IconSymbol } from './ui/icon-symbol';

type Mode = 'list' | 'create' | 'edit';
type Choice = 'today' | 'tomorrow' | 'period';
type Period = { from: string; to: string };
type Draft = {
  mode: 'create' | 'edit';
  editing: AbsenceNotice | null;
  choice: Choice;
  fromDate: string;
  toDate: string;
  reason: string;
  comment: string;
};

const unknownWrite = 'Не удалось подтвердить результат. Проверьте список отсутствий перед повтором.';

function preferredChoice(rules: AbsenceRules): Choice {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: rules.time_zone, hour: '2-digit', hourCycle: 'h23',
  }).format(new Date()));
  if (rules.today && (hour < 12 || !rules.tomorrow)) return 'today';
  return rules.tomorrow ? 'tomorrow' : 'period';
}

function singleDateLabel(date: string) {
  const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(date + 'T00:00:00Z'));
  return absenceDateText(date) + ' · ' + weekday;
}

const shortDate = (date: string) => absenceDateText(date).slice(0, 5);

function failureText(error: unknown) {
  if (!(error instanceof ApiError)) return 'Запрос не выполнен. Попробуйте ещё раз.';
  if (error.status === 403 || error.status === 404) return 'Доступ к предупреждению больше недоступен.';
  switch (error.data?.code) {
    case 'ABSENCE_CHILD_ARRIVED': return 'На сегодня уже есть отметка о приходе. Выберите другую дату.';
    case 'ABSENCE_NO_WORKING_DAYS': return 'В выбранном периоде нет рабочих дней.';
    case 'ABSENCE_DEADLINE_PASSED': return 'Срок изменения прошёл. Обновите предупреждение.';
    case 'ABSENCE_OVERLAP': return 'На эти даты уже есть предупреждение.';
    default:
      return error.status === null || error.status >= 500
        ? 'Не удалось получить ответ. Проверьте список отсутствий перед повтором.'
        : 'Проверьте даты, причину и комментарий.';
  }
}

export default function AbsenceSheet({ child, initialRules, initialMode, initialEntry, onClose, onSaved, onReload }: {
  child: Child;
  initialRules: AbsenceRules;
  initialMode: 'list' | 'create';
  initialEntry?: AbsenceNotice;
  onClose: () => void;
  onReload?: () => void;
  onSaved: (entry: AbsenceNotice, message: string, keepOpen?: boolean) => void;
}) {
  const styles = useStyles();
  const colors = usePalette();
  const [rules, setRules] = useState(initialRules);
  const [mode, setMode] = useState<Mode>(initialEntry ? 'edit' : initialMode);
  const [entryLoading, setEntryLoading] = useState(Boolean(initialEntry));
  const [entryFailed, setEntryFailed] = useState(false);
  const [entryRetry, setEntryRetry] = useState(0);
  const [editing, setEditing] = useState<AbsenceNotice | null>(initialEntry ?? null);
  const [choice, setChoice] = useState<Choice>(() => preferredChoice(initialRules));
  const [fromDate, setFromDate] = useState(initialEntry?.from ?? '');
  const [toDate, setToDate] = useState(initialEntry?.to ?? '');
  const [reason, setReason] = useState(initialEntry?.reason ?? '');
  const [comment, setComment] = useState(initialEntry?.comment ?? '');
  const [commentOpen, setCommentOpen] = useState(Boolean(initialEntry?.comment));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [pickerStart, setPickerStart] = useState<Period>();
  const periodOpen = Boolean(pickerStart);
  const [candidate, setCandidate] = useState<Period>();
  const [returnCalendarOpen, setReturnCalendarOpen] = useState(false);
  const [list, setList] = useState<AbsenceNotice[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const reloadCard = useRef(onReload);
  reloadCard.current = onReload;
  const alive = useRef(true);
  const [consentPrompt, setConsentPrompt] = useState<{ key: string; dates: string[] }>();
  const [conflict, setConflict] = useState<string | null>(null);
  const [returnDay, setReturnDay] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [preview, setPreview] = useState<{ key: string; option: AbsenceOption | null; error?: string }>();

  const custom = mode === 'edit' || choice === 'period';
  const preset = choice === 'period' ? null : rules[choice];
  const from = editing?.from ?? (custom ? fromDate : preset?.from);
  const to = custom ? toDate : preset?.to;
  const min = editing?.from ?? rules.earliest_from;
  const unchangedEnd = Boolean(editing && to === editing.to);
  const rangeValid = Boolean(from && to && from >= min && to >= from
    && (editing || rules.max_days_ahead == null || absenceDayDistance(rules.today_date, from) <= rules.max_days_ahead)
    && (unchangedEnd || rules.max_days == null || absenceDayDistance(from, to) < rules.max_days));
  const latestStart = rules.max_days_ahead == null
    ? undefined : shiftAbsenceDay(rules.today_date, rules.max_days_ahead);
  const returnFloor = rules.first_free_day ?? editing?.cancel_effect?.return_date ?? '';
  const returnMin = editing && returnFloor && returnFloor <= editing.from
    ? shiftAbsenceDay(editing.from, 1) : returnFloor;
  const previewKey = from && to ? from + '/' + to : '';
  const candidateKey = candidate ? candidate.from + '/' + candidate.to : '';
  const calculationRange = periodOpen ? candidate : from && to && rangeValid ? { from, to } : undefined;
  const calculationFrom = calculationRange?.from;
  const calculationTo = calculationRange?.to;
  const calculationKey = calculationFrom && calculationTo ? calculationFrom + '/' + calculationTo : '';
  const pendingConsent = consentPrompt?.key === previewKey ? consentPrompt.dates : [];
  const previewOption = custom ? preview?.key === previewKey ? preview.option : null : preset;
  const previewPaid = previewOption?.paid_days.filter((day) => !editing || day > editing.to) ?? [];
  const paidDates = pendingConsent.length ? pendingConsent : absencePaidDates(previewPaid);
  const submitLabel = editing ? 'Сохранить' : 'Сообщить саду';
  const deadline = rules.deadline?.slice(0, 5);
  const payingToday = paidDates.includes(rules.today_date);
  const paymentHeading = payingToday ? 'Сегодня уже не бесплатно.'
    : deadline ? 'Сообщаете после ' + deadline + '.' : 'Питание уже заказано.';
  const paymentHint = paidDates.length === 1
    ? 'День ' + shortDate(paidDates[0]) + ' будет оплачен.'
    : 'Дни ' + paidDates.map(shortDate).join(', ') + ' будут оплачены.';
  const paymentLabel = paidDates.map(shortDate).join(', ')
    + (paidDates.length === 1 ? ' оплачивается' : ' оплачиваются');
  const previewError = custom && preview?.key === previewKey ? preview.error : undefined;
  const selectedReason = rules.reasons.find((item) => item.code === reason);
  const dirty = !editing || !unchangedEnd || reason !== editing.reason
    || comment.trim() !== (editing.comment ?? '').trim();
  const reasonLabel = selectedReason?.name || reason || 'Выбрать';
  const ready = from && to && rangeValid && selectedReason && (unchangedEnd || previewOption?.working_days)
    && dirty && (!selectedReason.comment_required || Boolean(comment.trim()));

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    const request = new AbortController();
    if (mode === 'list') {
      void getChildAbsences(child.id, initialRules.today_date, request.signal).then((items) => {
        if (!request.signal.aborted) setList(items);
      }).catch((err) => {
        if (!request.signal.aborted) setError(failureText(err));
      });
    } else {
      void getAbsenceRules(child.id, request.signal).then((latest) => {
        if (!request.signal.aborted) setRules(latest);
      }).catch((err) => {
        if (!request.signal.aborted) setError(failureText(err));
      });
    }
    return () => request.abort();
  }, [child.id, initialRules.today_date, mode, refresh]);

  useEffect(() => {
    if (!initialEntry) return;
    const request = new AbortController();
    setEntryLoading(true);
    setEntryFailed(false);
    void getChildAbsences(child.id, initialEntry.from, request.signal).then(items => {
      if (request.signal.aborted) return;
      const current = items.find(item => item.external_key === initialEntry.external_key);
      if (current) {
        setEditing(current);
        setFromDate(current.from);
        setToDate(current.to);
        setReason(current.reason);
        setComment(current.comment ?? '');
        setCommentOpen(Boolean(current.comment));
      } else {
        reloadCard.current?.();
        setEditing(null);
        setList(items);
        setMode('list');
      }
    }).catch(() => {
      if (!request.signal.aborted) setEntryFailed(true);
    }).finally(() => {
      if (!request.signal.aborted) setEntryLoading(false);
    });
    return () => request.abort();
  }, [child.id, entryRetry, initialEntry]);

  useEffect(() => {
    if (mode === 'list' || (!custom && !periodOpen) || !calculationFrom || !calculationTo
      || (editing && calculationTo === editing.to)) return;
    const request = new AbortController();
    const timer = setTimeout(() => {
      void getAbsenceRules(child.id, request.signal, { from: calculationFrom, to: calculationTo }).then((latest) => {
        if (!request.signal.aborted) setPreview({ key: calculationKey, option: latest.period });
      }).catch((err) => {
        if (!request.signal.aborted) setPreview({ key: calculationKey, option: null, error: failureText(err) });
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [calculationFrom, calculationKey, calculationTo, child.id, custom, editing, mode, periodOpen, refresh]);

  function clearAlerts() {
    setError('');
    setConsentPrompt(undefined);
    setConflict(null);
  }

  function openEdit(entry: AbsenceNotice) {
    clearAlerts();
    setEditing(entry);
    setFromDate(entry.from);
    setToDate(entry.to);
    setReason(entry.reason);
    setComment(entry.comment ?? '');
    setCommentOpen(Boolean(entry.comment));
    setConfirmCancel(false);
    setReturnDay(null);
    setPickerStart(undefined);
    setReasonOpen(false);
    setMode('edit');
  }

  function rememberDraft() {
    if (mode !== 'list') setDraft({ mode, editing, choice, fromDate, toDate, reason, comment });
  }

  function restoreDraft() {
    if (!draft) return;
    clearAlerts();
    setEditing(draft.editing);
    setChoice(draft.choice);
    setFromDate(draft.fromDate);
    setToDate(draft.toDate);
    setReason(draft.reason);
    setComment(draft.comment);
    setCommentOpen(Boolean(draft.comment));
    setConfirmCancel(false);
    setReturnDay(null);
    setPickerStart(undefined);
    setReasonOpen(false);
    setMode(draft.mode);
    setDraft(null);
  }

  function backToList() {
    if (uncertain) return;
    const hasDraft = mode === 'edit' ? dirty : Boolean(reason || comment || fromDate || toDate);
    if (hasDraft && !confirmCancel && !draft) rememberDraft();
    setEditing(null);
    setReturnDay(null);
    setPickerStart(undefined);
    setReasonOpen(false);
    setConfirmCancel(false);
    setMode('list');
    setList(null);
    clearAlerts();
  }

  function startAnotherPeriod() {
    clearAlerts();
    setMode('create');
    setChoice(preferredChoice(rules));
    setEditing(null);
    setFromDate('');
    setToDate('');
    setReason('');
    setComment('');
    setCommentOpen(false);
  }

  function openPeriod() {
    const start = editing?.from || (choice === 'period' && fromDate ? fromDate : rules.tomorrow?.from ?? rules.earliest_from);
    const end = editing ? toDate : (choice === 'period' && toDate ? toDate : start);
    setCandidate({ from: start, to: end });
    setPickerStart({ from: start, to: end });
  }

  function confirmPeriod(start: string, end: string) {
    clearAlerts();
    setFromDate(start);
    setToDate(end);
    if (!editing) setChoice('period');
    setPickerStart(undefined);
  }

  async function mutate(operation: (writeStarted: () => void) => Promise<AbsenceNotice | undefined>, message: string | ((result: AbsenceNotice) => string)) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError('');
    let writing = false;
    try {
      const result = await operation(() => { writing = true; });
      if (alive.current && result) {
        const text = typeof message === 'string' ? message : message(result);
        if (draft) {
          restoreDraft();
          onSaved(result, text, true);
        } else {
          onSaved(result, text);
        }
      }
    } catch (err) {
      if (!alive.current) return;
      if (writing && (!(err instanceof ApiError) || err.status === null || err.status >= 500)) {
        setUncertain(true);
        setConsentPrompt(undefined);
        setError(unknownWrite);
      } else if (err instanceof ApiError && err.data?.code === 'ABSENCE_CHILD_ARRIVED') {
        const latest = await getAbsenceRules(child.id).catch(() => null);
        if (!alive.current) return;
        setRules(previous => ({
          ...(latest ?? previous),
          today: null,
          earliest_from: latest?.earliest_from ?? shiftAbsenceDay(previous.today_date, 1),
        }));
        if (!custom) setChoice((latest ?? rules).tomorrow ? 'tomorrow' : 'period');
        setConsentPrompt(undefined);
        setError(custom ? 'На сегодня уже отмечен приход. Выберите новый первый день, чтобы сохранить период.'
          : 'На сегодня уже есть отметка о приходе.');
      } else if (err instanceof ApiError && err.data?.code === 'ABSENCE_PAID_DAYS_NOT_ACCEPTED') {
        const dates = absencePaidDates(err.data.paid_days);
        if (dates.length) setConsentPrompt({ key: previewKey, dates });
        else setError('Не удалось определить оплачиваемые дни. Обновите форму.');
      } else {
        if (err instanceof ApiError && err.data?.code === 'ABSENCE_OVERLAP'
          && typeof err.data.absence_external_key === 'string') {
          setConflict(err.data.absence_external_key);
          if (await resolveConflict(err.data.absence_external_key)) {
            setError('На выбранные даты уже есть предупреждение.');
            return;
          }
          if (!alive.current) return;
        }
        setError(failureText(err));
      }
    } finally {
      guard.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function submit() {
    if (uncertain || !ready || !from || !to) return;
    void mutate(
      async (writeStarted) => {
        let consent: { accept_paid_days: boolean; accepted_paid_days?: string[] } = { accept_paid_days: false };
        if (paidDates.length) {
          const latest = await getAbsenceRules(child.id, undefined, { from, to });
          if (!alive.current) return;
          setRules(latest);
          if (!custom) {
            const updated = latest[choice];
            if (updated?.from !== from || updated.to !== to) {
              setConsentPrompt(undefined);
              setError('Дата изменилась. Проверьте период перед сохранением.');
              return;
            }
          }
          if (custom) setPreview({ key: previewKey, option: latest.period });
          let baseline = editing;
          if (editing && latest.supports_exact_paid_days !== true) {
            const entries = await getChildAbsences(child.id, latest.today_date);
            if (!alive.current) return;
            const current = entries.find(entry => entry.external_key === editing.external_key);
            if (!current?.editable) {
              setConsentPrompt(undefined);
              setError('Запись больше недоступна для изменения. Проверьте список отсутствий.');
              return;
            }
            baseline = current;
          }
          const paid = absencePaidDates(latest.period?.paid_days).filter((day) => !baseline || day > baseline.to);
          const endChanged = baseline?.to !== editing?.to;
          if (endChanged && baseline && editing) {
            if (reason === editing.reason) setReason(baseline.reason);
            if (comment === (editing.comment ?? '')) setComment(baseline.comment ?? '');
            setEditing(baseline);
          }
          const exactConsent = latest.supports_exact_paid_days === true;
          const paidChanged = paid.length !== paidDates.length || paid.some((day) => !paidDates.includes(day));
          // An exact server's write-time conflict accounts for concurrent changes to the stored period.
          if (endChanged || (paidChanged && !(exactConsent && pendingConsent.length))) {
            setConsentPrompt(paid.length ? { key: previewKey, dates: paid } : undefined);
            setError('Расчёт изменился. Проверьте даты перед сохранением.');
            return;
          }
          consent = exactConsent
            ? { accept_paid_days: false, accepted_paid_days: paidDates }
            : { accept_paid_days: true };
        }
        writeStarted();
        if (!editing) return createAbsence({ ...consent, to, reason, comment: comment.trim(), from, child_external_key: child.id });
        return updateAbsence(editing.external_key, {
          ...consent,
          ...(!unchangedEnd && { to }),
          ...(reason !== editing.reason && { reason }),
          ...(comment.trim() !== (editing.comment ?? '').trim() && { comment: comment.trim() }),
        });
      },
      editing ? 'Изменения сохранены' : 'Сад уведомлён',
    );
  }

  function confirmCancellation() {
    if (!editing || uncertain) return;
    void mutate(async (writeStarted) => {
      const latest = await getChildAbsences(child.id, rules.today_date);
      if (!alive.current) return;
      const current = latest.find((item) => item.external_key === editing.external_key);
      if (!current?.cancellable) {
        setConfirmCancel(false);
        setError('Запись уже изменилась. Проверьте список отсутствий.');
        return;
      }
      if (current.cancel_effect?.kind !== editing.cancel_effect?.kind
        || current.cancel_effect?.return_date !== editing.cancel_effect?.return_date || current.to !== editing.to) {
        openEdit(current);
        setConfirmCancel(true);
        setError('Условия изменились. Проверьте их перед подтверждением.');
        return;
      }
      writeStarted();
      return cancelAbsence(current.external_key);
    }, (result) => result.status === 'CANCELLED' ? 'Предупреждение отменено' : 'Период сокращён');
  }

  function saveEarlierReturn() {
    if (!editing || !returnDay || returnDay < returnMin || returnDay > editing.to || uncertain) return;
    void mutate(async (writeStarted) => {
      const [latest, latestRules] = await Promise.all([
        getChildAbsences(child.id, rules.today_date), getAbsenceRules(child.id),
      ]);
      if (!alive.current) return;
      setRules(latestRules);
      const current = latest.find((item) => item.external_key === editing.external_key);
      if (!current?.editable || current.cancel_effect?.kind !== 'SHORTEN'
        || current.to !== editing.to || returnDay < (latestRules.first_free_day ?? current.cancel_effect.return_date ?? '9999-12-31')) {
        if (current) openEdit(current);
        else setReturnDay(null);
        setError('Условия изменились. Проверьте предупреждение.');
        return;
      }
      writeStarted();
      return updateAbsence(current.external_key, { to: shiftAbsenceDay(returnDay, -1), accept_paid_days: false });
    }, (result) => result.return_date
      ? 'Период сокращён. Возвращение — ' + absenceDateText(result.return_date) + '.'
      : 'Период сокращён');
  }

  async function reconcile() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    try {
      const latest = await getChildAbsences(child.id, rules.today_date);
      if (!alive.current) return;
      reloadCard.current?.();
      if (mode === 'edit' && editing) {
        const current = latest.find(item => item.external_key === editing.external_key);
        if (current) {
          if (toDate === editing.to) setToDate(current.to);
          if (reason === editing.reason) setReason(current.reason);
          if (comment === (editing.comment ?? '')) setComment(current.comment ?? '');
          setEditing(current);
          setUncertain(false);
          setReturnDay(null);
          setConfirmCancel(false);
          clearAlerts();
          setError('Список проверен. Проверьте данные перед сохранением.');
          return;
        }
      }
      if (mode === 'create' && !draft) rememberDraft();
      setUncertain(false);
      setReturnDay(null);
      setConfirmCancel(false);
      setEditing(null);
      clearAlerts();
      setList(latest);
      setMode('list');
    } catch (err) {
      if (alive.current) setError(failureText(err));
    } finally {
      guard.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function resolveConflict(key: string) {
    const latest = await getChildAbsences(child.id, rules.today_date).catch(() => null);
    if (!alive.current || !latest) return false;
    const match = latest.find(item => item.external_key === key);
    if (!match) return false;
    if (!draft) rememberDraft();
    openEdit(match);
    setList(latest);
    return true;
  }

  async function openConflict() {
    if (!conflict || guard.current) return;
    guard.current = true;
    setBusy(true);
    try {
      if (!(await resolveConflict(conflict)) && alive.current) {
        setError('Не удалось открыть предупреждение. Черновик сохранён.');
      }
    } finally {
      guard.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const readOnly = mode === 'edit' && (entryLoading || entryFailed || !editing?.editable);
  const showSubmit = mode !== 'list' && (mode === 'create' || dirty) && !confirmCancel && returnDay === null && !reasonOpen && !readOnly && !uncertain;
  const title = confirmDiscard ? 'Выйти без сохранения?' : returnDay !== null ? 'Когда ' + child.firstName + ' вернётся?'
    : confirmCancel ? 'Отменить отсутствие?'
      : reasonOpen ? 'Причина отсутствия'
        : mode === 'create' ? child.firstName + ' не придёт'
          : mode === 'edit' ? 'Отсутствие · ' + child.firstName : 'Все периоды';
  const close = () => {
    if (guard.current || uncertain) return;
    if (confirmDiscard) setConfirmDiscard(false);
    else if (reasonOpen) setReasonOpen(false);
    else if (confirmCancel) setConfirmCancel(false);
    else if (returnDay !== null) setReturnDay(null);
    else if (draft || (mode === 'edit' && dirty) || (mode === 'create'
      && (reason || comment.trim() || fromDate || toDate || choice !== preferredChoice(rules)))) setConfirmDiscard(true);
    else onClose();
  };

  if (confirmDiscard) {
    return (
      <BottomSheet title={title} closeLabel="Назад" onClose={close}>
        <ActionButton label="Продолжить редактирование" onPress={() => setConfirmDiscard(false)} />
        <ActionButton label="Выйти без сохранения" variant="text" onPress={onClose} />
      </BottomSheet>
    );
  }

  if (pickerStart) {
    const candidatePreview = preview?.key === candidateKey ? preview : undefined;
    return <AbsencePeriodPicker initialFrom={pickerStart.from} initialTo={pickerStart.to}
      min={min} maxStart={editing ? undefined : latestStart} maxLength={rules.max_days ?? undefined}
      canChangeStart={!editing} existingTo={editing?.to}
      workingDays={candidatePreview && !candidatePreview.error ? candidatePreview.option?.working_days ?? 0 : undefined}
      previewError={candidatePreview?.error} onRetry={() => {
        setPreview(undefined);
        setRefresh(value => value + 1);
      }}
      onRangeChange={(start, end) => setCandidate({ from: start, to: end })}
      onClose={() => setPickerStart(undefined)} onConfirm={confirmPeriod} />;
  }

  const submitFooter = showSubmit ? (
    <>
      {error && <StatusMessage tone="error" message={error} />}
      {mode === 'create' && rules.deadline_enabled && deadline && (
        <Text style={styles.hint}>{payingToday ? 'Пока ребёнка не привели в сад'
          : paidDates.length ? 'После ' + deadline + ' — день оплачивается' : 'До ' + deadline}</Text>
      )}
      <ActionButton label={paidDates.length ? (editing ? 'Сохранить' : 'Сообщить') + ' · ' + paymentLabel : submitLabel}
        loading={busy} disabled={!ready} onPress={submit} />
    </>
  ) : undefined;

  return (
    <BottomSheet title={title} onClose={close} closeLabel={reasonOpen ? 'Назад' : 'Закрыть'}
      closeDisabled={busy || uncertain} footer={submitFooter}>
      {entryLoading && <Text accessibilityLiveRegion="polite" style={styles.hint}>Обновляем запись…</Text>}
      {entryFailed && <ActionButton label="Обновить запись" variant="text"
        onPress={() => setEntryRetry(value => value + 1)} />}
      {mode === 'list' ? (
        <View style={styles.list}>
          {draft && <ActionButton label="Вернуться к черновику" variant="text" onPress={restoreDraft} />}
          {list?.map((entry) => (
            <ActionButton key={entry.external_key} variant="text" onPress={() => openEdit(entry)}
              label={absenceRangeText(entry.from, entry.to) + ' · ' +
                (rules.reasons.find((item) => item.code === entry.reason)?.name ?? entry.reason)} />
          ))}
          {list?.length === 0 && <Text style={styles.hint}>Активных предупреждений нет.</Text>}
          {list === null && !error && <Text style={styles.hint}>Загрузка предупреждений…</Text>}
          {list && rules.can_report && <ActionButton label="Сообщить о другом периоде"
            variant="text" onPress={startAnotherPeriod} />}
          {error && <ActionButton label="Повторить" variant="text" onPress={() => {
            setError('');
            setRefresh((value) => value + 1);
          }} />}
        </View>
      ) : returnDay !== null && editing ? (
        <View style={styles.section}>
          <Pressable style={styles.row} accessibilityRole="button" disabled={busy || uncertain}
            onPress={() => setReturnCalendarOpen(value => !value)}>
            <Text style={styles.body}>Первый день в саду</Text>
            <Text style={styles.hint}>{absenceDateText(returnDay)} ›</Text>
          </Pressable>
          {returnCalendarOpen && <AbsenceCalendar min={returnMin} max={editing.to} selected={returnDay}
            onChoose={day => { setReturnDay(day); setReturnCalendarOpen(false); }} />}
          <Text style={styles.hint}>Отсутствие останется на {absenceRangeText(editing.from, shiftAbsenceDay(returnDay, -1))}.</Text>
          <ActionButton label="Сохранить" loading={busy} disabled={uncertain || returnDay < returnMin || returnDay > editing.to}
            onPress={saveEarlierReturn} />
          <ActionButton label="Оставить" variant="text" disabled={busy || uncertain} onPress={() => {
            setReturnDay(null);
            clearAlerts();
          }} />
        </View>
      ) : confirmCancel && editing ? (
        <View style={styles.section}>
          {editing.cancel_effect?.return_date && (
            <Text style={styles.hint}>{child.firstName} сможет прийти {absenceDateText(editing.cancel_effect.return_date)}.</Text>
          )}
          <ActionButton label={editing.cancel_effect?.kind === 'SHORTEN' ? 'Сократить отсутствие' : 'Отменить отсутствие'} loading={busy} disabled={uncertain} onPress={confirmCancellation} />
          <ActionButton label="Оставить" variant="text" disabled={busy} onPress={() => {
            setConfirmCancel(false);
            clearAlerts();
          }} />
        </View>
      ) : reasonOpen ? (
        <View accessibilityRole="radiogroup">
          {rules.reasons.map(item => (
            <Pressable key={item.code} style={styles.row} accessibilityRole="radio"
              accessibilityState={{ checked: reason === item.code }} disabled={busy} onPress={() => {
                clearAlerts();
                setReason(item.code);
                if (item.comment_required) setCommentOpen(true);
                setReasonOpen(false);
              }}>
              <Text style={styles.body}>{item.name}</Text>
              {reason === item.code && <Text style={styles.link}>✓</Text>}
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <View style={styles.section}>
            {mode === 'create' && (
              <View accessibilityRole="radiogroup" style={styles.choices}>
                {(['today', 'tomorrow', 'period'] as const).map((item) => {
                  if (item !== 'period' && !rules[item]) return null;
                  const name = { today: 'Сегодня', tomorrow: 'Завтра', period: 'Другие даты' }[item];
                  return (
                    <Pressable key={item} style={[styles.choice, item === choice && styles.active]} accessibilityRole="radio"
                      accessibilityState={{ checked: item === choice }} disabled={busy || uncertain} onPress={() => {
                        if (item === 'period') openPeriod();
                        else {
                          clearAlerts();
                          setChoice(item);
                        }
                      }}>
                      <Text style={[styles.segmentText, item === choice && styles.activeText]}>{name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {from && to && (editing ? (
              <Pressable accessibilityRole={readOnly ? undefined : 'button'}
                accessibilityLabel={readOnly ? undefined : 'Даты: ' + absenceRangeText(from, to)}
                disabled={busy || readOnly || uncertain} style={styles.row} onPress={openPeriod}>
                <Text style={styles.body}>Даты</Text>
                <Text style={styles.hint}>{absenceRangeText(from, to)}{readOnly ? '' : ' ›'}</Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>{from === to ? singleDateLabel(from) : absenceRangeText(from, to)}</Text>
            ))}
            {editing?.paid_days.filter(day => !day.waived).map(day => (
              <Text key={day.date} style={styles.paidText}>₽  {shortDate(day.date)} оплачивается</Text>
            ))}
          </View>
          {!readOnly && paidDates.length > 0 && (
            <View style={styles.payment} accessibilityLiveRegion="polite">
              <Text style={styles.paymentTitle}>₽  {paymentHeading}</Text>
              <Text style={styles.paymentBody}>{paymentHint}</Text>
            </View>
          )}
          {previewError && (
            <View>
              <Text style={styles.error}>{previewError}</Text>
              <ActionButton label="Обновить расчёт" variant="text" onPress={() => setRefresh((value) => value + 1)} />
            </View>
          )}
          <View style={styles.section}>
            <Pressable style={styles.row} accessibilityRole="button" disabled={busy || readOnly || uncertain}
              accessibilityLabel={'Причина: ' + reasonLabel} onPress={() => setReasonOpen(true)}>
              <Text style={styles.body}>Причина</Text>
              <View style={styles.rowValue}>
                <Text style={styles.valueText}>{reasonLabel}</Text>
                {!readOnly && <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />}
              </View>
            </Pressable>
            {readOnly ? (comment ? <Text style={styles.hint}>{comment}</Text> : null) : (
              <View>
                {!selectedReason?.comment_required && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Комментарий"
                    accessibilityState={{ expanded: commentOpen, disabled: busy || uncertain }}
                    disabled={busy || uncertain} onPress={() => setCommentOpen(open => !open)}
                    style={styles.commentToggle}>
                    <Text style={styles.body}>Комментарий</Text>
                    <IconSymbol name="chevron.down" size={20} color={colors.textSecondary}
                      style={commentOpen && styles.chevronOpen} />
                  </Pressable>
                )}
                {(commentOpen || selectedReason?.comment_required) && (
                  <FormField label={selectedReason?.comment_required ? 'Комментарий (обязательно)' : 'Комментарий (необязательно)'}
                    hideVisualLabel={!selectedReason?.comment_required}
                    placeholder="Не указывайте диагноз — достаточно причины" multiline value={comment} maxLength={500}
                    containerStyle={styles.commentField} style={styles.commentInput}
                    editable={!busy && !uncertain} onChangeText={value => { clearAlerts(); setComment(value); }} />
                )}
              </View>
            )}
          </View>
          {!entryLoading && !entryFailed && editing?.cancellable && (editing.cancel_effect?.kind === 'SHORTEN' ? (
            <Pressable accessibilityRole="button" style={styles.inlineAction} disabled={busy || uncertain} onPress={() => {
              clearAlerts();
              if (editing.editable && returnMin && returnMin <= editing.to) {
                setReturnCalendarOpen(false);
                setReturnDay(returnMin);
              } else setConfirmCancel(true);
            }}><Text style={styles.link}>Указать день возвращения</Text></Pressable>
          ) : (
            <Pressable accessibilityRole="button" style={styles.inlineAction} disabled={busy || uncertain}
              onPress={() => { clearAlerts(); setConfirmCancel(true); }}>
              <Text style={styles.error}>Отменить отсутствие</Text>
            </Pressable>
          ))}
        </>
      )}
      {draft && mode !== 'list' && <ActionButton label="Вернуться к черновику" variant="text"
        disabled={busy || uncertain} onPress={restoreDraft} />}
      {uncertain && <ActionButton label="Проверить список отсутствий" loading={busy} onPress={() => void reconcile()} />}
      {error && !showSubmit && <StatusMessage tone="error" message={error} />}
      {conflict && <ActionButton label="Открыть существующее предупреждение" variant="text" disabled={busy}
        onPress={() => void openConflict()} />}
      {!uncertain && !entryLoading && !reasonOpen && !confirmCancel && returnDay === null && mode === 'edit' && (
        <Pressable accessibilityRole="button" accessibilityLabel="Все периоды"
          style={styles.navigation} disabled={busy} onPress={backToList}>
          <Text style={styles.link}>Все периоды</Text>
          <Text style={styles.hint} accessible={false}>›</Text>
        </Pressable>
      )}
    </BottomSheet>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  section: { gap: space.md },
  commentToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: controlHeight.touch },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  commentInput: { minHeight: controlHeight.field + space.xl, textAlignVertical: 'top' },
  rowValue: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.xxs },
  valueText: { flexShrink: 1, textAlign: 'right', fontSize: typeSize.label, color: c.textSecondary },
  commentField: { marginBottom: 0 },
  list: { gap: space.xxs },
  body: { fontSize: typeSize.body, color: c.text },
  hint: { fontSize: typeSize.label, color: c.textSecondary },
  error: { fontSize: typeSize.label, color: c.danger },
  choices: { flexDirection: 'row', gap: space.xs },
  choice: { flex: 1, minHeight: controlHeight.touch, paddingHorizontal: space.xs, borderRadius: radius.control, backgroundColor: c.fill,
    alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: c.actionPrimary },
  segmentText: { color: c.text, fontSize: typeSize.label, textAlign: 'center' },
  activeText: { color: c.onActionPrimary, fontWeight: '700' },
  row: { minHeight: controlHeight.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator },
  inlineAction: { minHeight: controlHeight.touch, justifyContent: 'center' },
  navigation: { minHeight: controlHeight.touch, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: space.xxs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator },
  link: { color: c.actionPrimary, fontSize: typeSize.label },
  payment: { backgroundColor: c.warning + '1A', borderRadius: radius.control, padding: space.md, gap: space.xxs },
  paymentTitle: { fontSize: typeSize.label, fontWeight: '700', color: c.text },
  paymentBody: { fontSize: typeSize.label, color: c.text },
  paidText: { fontSize: typeSize.label, color: c.danger },
}));
