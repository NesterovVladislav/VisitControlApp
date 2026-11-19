import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { controlHeight, space, typeSize } from '../constants/ui-tokens';
import { makeStyles } from '../hooks/use-palette';
import { Child, ChildStatus, isInKindergarten } from '../store/types/children';
import { pendingLabel } from './child-card';
import { BottomSheet } from './ui';
import { IconSymbol } from './ui/icon-symbol';

const sections = [
  { id: 'home', label: 'Главная' },
  { id: 'calendar', label: 'Календарь' },
  { id: 'group', label: 'Группа' },
] as const;
export type ParentSection = typeof sections[number]['id'];

function childStatus(status?: ChildStatus) {
  if (status?.visit?.pending) return pendingLabel(status.visit.pending);
  if (!status?.value) return status?.error ? 'Статус неизвестен' : 'Загружаем статус';
  return isInKindergarten(status.value) ? 'В саду' : 'Не в саду';
}

export function ParentChildSelector({ items, selected, statuses, onSelect }: {
  items: Child[];
  selected: Child;
  statuses: Record<string, ChildStatus>;
  onSelect: (child: Child) => void;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  function choice(child: Child, compact: boolean) {
    const active = selected.id === child.id;
    const sameFirstName = items.some(other => other.id !== child.id && other.firstName === child.firstName);
    const name = compact && !sameFirstName ? child.firstName : `${child.firstName} ${child.surname}`.trim();
    return (
      <Pressable key={child.id} accessibilityRole="button" accessibilityState={{ selected: active }}
        accessibilityLabel={`${child.firstName} ${child.surname}, ${childStatus(statuses[child.id])}`}
        onPress={() => { onSelect(child); setOpen(false); }}
        style={[styles.choice, compact && styles.half, active && styles.selected]}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.status}>{childStatus(statuses[child.id])}</Text>
      </Pressable>
    );
  }
  if (items.length < 2) return null;
  return (
    <View style={styles.band}>
      {items.length === 2 ? items.map(child => choice(child, true)) : (
        <Pressable style={styles.picker} accessibilityRole="button" accessibilityLabel={`Выбрать ребёнка: ${selected.firstName} ${selected.surname}, ${childStatus(statuses[selected.id])}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}>
          <View style={styles.grow}>
            <Text style={styles.name}>{selected.firstName} {selected.surname}</Text>
            <Text style={styles.status}>{childStatus(statuses[selected.id])}</Text>
          </View>
          <IconSymbol name="chevron.down" size={22} color={styles.name.color} />
        </Pressable>
      )}
      {open && <BottomSheet title="Выберите ребёнка" onClose={() => setOpen(false)}>
        {items.map(child => choice(child, false))}
      </BottomSheet>}
    </View>
  );
}

export function ParentSectionBar({ selected, showCalendar, onSelect }: {
  selected: ParentSection;
  showCalendar: boolean;
  onSelect: (section: ParentSection) => void;
}) {
  const styles = useStyles();
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottom, space.xxs) }]} accessibilityRole="tablist">
      {sections.filter(tab => tab.id !== 'calendar' || showCalendar).map(tab => (
        <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: selected === tab.id }}
          style={[styles.tab, selected === tab.id && styles.selected]} onPress={() => onSelect(tab.id)}>
          <Text style={[styles.tabText, selected === tab.id && styles.activeText]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles(c => StyleSheet.create({
  band: { flexDirection: 'row', alignSelf: 'center', width: '100%', maxWidth: 480, paddingHorizontal: space.lg,
    paddingTop: space.sm, gap: space.md },
  choice: { minHeight: controlHeight.touch, paddingVertical: space.sm, paddingHorizontal: space.sm,
    borderBottomWidth: 2, borderColor: c.separator, justifyContent: 'center' },
  half: { flex: 1 },
  selected: { borderColor: c.actionPrimary },
  name: { fontSize: typeSize.body, color: c.text, fontWeight: '600' },
  status: { fontSize: typeSize.caption, color: c.textSecondary },
  picker: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, minHeight: controlHeight.touch },
  grow: { flex: 1 },
  bar: { flexDirection: 'row', backgroundColor: c.card, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  tab: { flex: 1, minHeight: controlHeight.action, borderTopWidth: 2, borderColor: 'transparent',
    padding: space.xs, justifyContent: 'center', alignItems: 'center' },
  tabText: { fontSize: typeSize.label, color: c.textSecondary, textAlign: 'center' },
  activeText: { color: c.actionPrimary, fontWeight: '700' },
}));
