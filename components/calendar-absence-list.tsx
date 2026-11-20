import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AbsenceNotice, AbsenceRules, getChildAbsences } from '../services/api/absence';
import type { AttendanceDay } from '../services/api/own-attendance';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { radius, space, typeSize } from '../constants/ui-tokens';
import type { Child } from '../store/types/children';
import { personName } from '../utils/people-format';
import { ActionButton, StatusMessage } from './ui';
import { CompactBackHeader } from './profile-page-header';
import AbsenceSheet from './absence-sheet';
import { periodLabel } from './calendar-absence-entry';

export function CalendarAbsenceList({ child, rules, day, onBack, onReturnToDay, onRefresh }: {
  child: Child; rules: AbsenceRules; day?: AttendanceDay; onBack: () => void; onReturnToDay: () => void; onRefresh: () => void;
}) {
  const s = useStyles(), c = usePalette();
  const [entries, setEntries] = useState<AbsenceNotice[]>();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<AbsenceNotice | 'create'>();
  const pending = useRef(day);
  const linked = useRef(false);
  const [notice, setNotice] = useState('');
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') setRevision(n => n + 1); });
    return () => { sub.remove(); foreground.remove(); };
  }, [onBack]));
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    getChildAbsences(child.id, rules.today_date, controller.signal).then(items => {
      if (controller.signal.aborted) return;
      setEntries(items);
      const pendingDay = pending.current;
      if (pendingDay?.absencePeriod) {
        const matches = items.filter(e => e.reason === pendingDay.reason && e.from === pendingDay.absencePeriod?.from && e.to === pendingDay.absencePeriod.to);
        if (matches.length === 1) { linked.current = true; setTarget(matches[0]); }
        else setNotice('Запись изменилась. Проверьте список отсутствий.');
        pending.current = undefined;
      }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [child.id, rules.today_date, revision]);
  function closeEditor() {
    setTarget(undefined);
    if (linked.current) { linked.current = false; onReturnToDay(); }
  }
  function refresh() { setRevision(n => n + 1); onRefresh(); }
  return <View style={s.screen}>
    <CompactBackHeader title="Отсутствия" backLabel="Назад в календарь" onBack={onBack} />
    <ScrollView contentContainerStyle={s.content}><Text style={s.context}>{personName(child)}</Text>
      <View style={s.panel}>
        {failed ? <><StatusMessage message="Не удалось загрузить отсутствия" tone="error" /><ActionButton variant="text" label="Повторить" onPress={() => setRevision(n => n + 1)} /></> :
          entries ? entries.length ? entries.map(entry => <Pressable key={entry.external_key} accessibilityRole="button" style={s.row} onPress={() => setTarget(entry)}>
            <View style={s.copy}><Text style={s.title}>{periodLabel(entry.from, entry.to, rules.today_date)}</Text>
              <Text style={s.context}>{rules.reasons.find(r => r.code === entry.reason)?.name ?? entry.reason}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={c.textSecondary} /></Pressable>) :
            <Text style={s.context}>Ничего не запланировано</Text> : <ActivityIndicator accessibilityLabel="Загружаем отсутствия" />}
        {rules.can_report && <ActionButton variant="text" label="Сообщить об отсутствии" onPress={() => setTarget('create')} />}
      </View>{notice ? <StatusMessage message={notice} /> : null}
    </ScrollView>
    {target && <AbsenceSheet child={child} initialRules={rules} initialMode={target === 'create' ? 'create' : 'list'}
      initialEntry={target === 'create' ? undefined : target} fromCalendar onClose={closeEditor} onReload={refresh}
      onSaved={(_, message, keepOpen) => { setNotice(message); refresh(); if (!keepOpen) closeEditor(); }} />}
  </View>;
}
const useStyles = makeStyles(c => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: space.md, gap: space.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
  panel: { borderRadius: radius.card, backgroundColor: c.card, padding: space.md },
  row: { minHeight: 56, gap: space.sm, alignItems: 'center', flexDirection: 'row', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  copy: { flex: 1 }, title: { color: c.text, fontSize: typeSize.body, fontWeight: '600' },
  context: { color: c.textSecondary, fontSize: typeSize.label },
}));
