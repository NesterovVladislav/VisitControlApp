import { SheetControl } from './ui/sheet-control';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { shiftAbsenceDay } from '../services/api/absence';
import { plural } from '../utils/plural';
import AbsenceCalendar, { absenceDateText } from './absence-calendar';
import { ActionButton } from './ui';
import { IconSymbol } from './ui/icon-symbol';

type Props = {
  initialFrom: string | null;
  initialTo: string | null;
  min: string;
  maxStart?: string;
  maxLength?: number;
  canChangeStart?: boolean;
  existingTo?: string;
  workingDays?: number;
  previewError?: string;
  onRetry?: () => void;
  onRangeChange?: (from: string, to: string) => void;
  onClose: () => void;
  onConfirm: (from: string, to: string) => void;
  isWorkingDay?: (date: string) => boolean;
};

type Endpoint = 'from' | 'to';

export default function AbsencePeriodPicker({
  initialFrom, initialTo, min, maxStart, maxLength, canChangeStart = true, existingTo,
  workingDays, previewError, onRetry, onRangeChange, onClose, onConfirm, isWorkingDay,
}: Props) {
  const styles = useStyles();
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [initialRange] = useState(() => ({ from: initialFrom, to: initialTo }));
  const [endpoint, setEndpoint] = useState<Endpoint>(() => !canChangeStart || (initialFrom && !initialTo) ? 'to' : 'from');
  const initialNotified = useRef(false);

  // Subsequent changes notify synchronously so the parent clears any stale preview with the same render.
  useEffect(() => {
    if (!initialNotified.current && onRangeChange && initialRange.from && initialRange.to && initialRange.to >= initialRange.from) {
      initialNotified.current = true;
      onRangeChange(initialRange.from, initialRange.to);
    }
  }, [initialRange, onRangeChange]);

  const endLimit = from && maxLength != null ? shiftAbsenceDay(from, maxLength - 1) : undefined;
  const endMax = !canChangeStart && endLimit && existingTo && existingTo > endLimit ? existingTo : endLimit;
  const rangeComplete = from !== null && to !== null && to >= from;
  const unchanged = !canChangeStart && rangeComplete && from === initialRange.from && to === existingTo;
  const inBounds = rangeComplete && from >= min && (!maxStart || from <= maxStart || !canChangeStart)
    && (!endLimit || to <= endLimit);
  const valid = unchanged || inBounds;
  const dayCount = valid && rangeComplete ? workingDays ?? countWorkingDays(from, to, isWorkingDay) : undefined;
  const canConfirm = Boolean(unchanged || (valid && !previewError && dayCount != null && dayCount > 0));
  const selected = endpoint === 'from' ? from : to ?? from;
  const calendarMin = endpoint === 'from' ? min : from ?? min;
  const calendarMax = endpoint === 'from' ? maxStart : endMax;
  const status = !rangeComplete
    ? !from ? 'Выберите первый день' : 'Выберите последний день'
    : !valid ? 'Выберите допустимый период'
    : previewError ?? (dayCount === undefined ? 'Рассчитываем дни посещения'
      : dayCount === 0 ? 'В этом периоде нет дней посещения'
      : `${dayCount} ${plural(dayCount, ['день посещения', 'дня посещения', 'дней посещения'])}`);

  function choose(day: string) {
    if (endpoint === 'from') {
      setFrom(day);
      setTo(null);
      setEndpoint('to');
    } else if (from) {
      setTo(day);
      onRangeChange?.(from, day);
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]} accessibilityViewIsModal>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <SheetControl back onPress={onClose} />
            <Text accessibilityRole="header" style={styles.title}>Даты отсутствия</Text>
          </View>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.endpoints}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Первый день, ${from ? absenceDateText(from) : 'не выбран'}`}
                accessibilityState={{ selected: endpoint === 'from', disabled: !canChangeStart }}
                disabled={!canChangeStart}
                onPress={() => setEndpoint('from')}
                style={[styles.endpoint, endpoint === 'from' && styles.activeEndpoint]}
              >
                <Text style={styles.label}>Первый день</Text>
                <Text style={styles.date}>{from ? absenceDateText(from) : 'Выбрать'}</Text>
                {canChangeStart && <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Последний день, ${to ? absenceDateText(to) : 'не выбран'}`}
                accessibilityState={{ selected: endpoint === 'to', disabled: !from }}
                disabled={!from}
                onPress={() => setEndpoint('to')}
                style={[styles.endpoint, endpoint === 'to' && styles.activeEndpoint]}
              >
                <Text style={styles.label}>Последний день</Text>
                <Text style={styles.date}>{to ? absenceDateText(to) : 'Выбрать'}</Text>
                <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.calendar}>
              <AbsenceCalendar
                selected={selected ?? ''}
                min={calendarMin}
                max={calendarMax}
                range={from ? { from, to } : undefined}
                isDateDisabled={endpoint === 'to' && endMax !== endLimit
                  ? (day) => Boolean(endLimit && day > endLimit && day !== existingTo) : undefined}
                onChoose={choose}
              />
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.label}>
              {unchanged && dayCount === undefined ? 'Выбран текущий период' : status}
            </Text>
            {rangeComplete && valid && !unchanged && previewError && onRetry ? (
              <ActionButton label="Повторить" variant="text" onPress={onRetry} />
            ) : null}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <ActionButton
            label="Выбрать даты"
            disabled={!canConfirm}
            onPress={() => { if (canConfirm && from && to) onConfirm(from, to); }}
          />
        </View>
      </View>
    </Modal>
  );
}

function countWorkingDays(from: string, to: string, isWorkingDay?: (date: string) => boolean) {
  if (!isWorkingDay) return undefined;
  let count = 0;
  for (let date = from; date <= to; date = shiftAbsenceDay(date, 1)) {
    if (isWorkingDay(date)) count += 1;
  }
  return count;
}

const useStyles = makeStyles((c) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  header: { backgroundColor: c.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator },
  headerContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
  },
  title: { flex: 1, color: c.text, fontSize: typeSize.body, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: space.lg },
  content: { alignSelf: 'center', width: '100%', maxWidth: 480, gap: space.md, paddingHorizontal: space.lg },
  endpoints: { gap: space.sm },
  endpoint: {
    minHeight: controlHeight.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.separator,
    borderRadius: radius.card,
    padding: space.sm,
  },
  activeEndpoint: { borderColor: c.actionPrimary },
  label: { color: c.textSecondary, fontSize: typeSize.caption },
  date: { flex: 1, textAlign: 'right', color: c.text, fontSize: typeSize.label, fontWeight: '600' },
  calendar: { backgroundColor: c.card, borderRadius: radius.card, padding: space.sm },
  footer: { alignSelf: 'center', width: '100%', maxWidth: 480, paddingHorizontal: space.lg, paddingVertical: space.md },
}));
