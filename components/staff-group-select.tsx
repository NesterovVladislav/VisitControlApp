import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { Presence, VisitEntry } from '../store/types/visits';
import OptionSheet, { SheetSection } from './option-sheet';
import { IconSymbol } from './ui/icon-symbol';

export type StaffGroup = { id: string; name: string; branchName: string | null };

export function staffGroups(presence: Presence, entries: VisitEntry[] = []): StaffGroup[] {
  const branches = new Map(presence.branches.map(branch => [branch.id, branch.name]));
  const groups = new Map<string, StaffGroup>();
  for (const group of presence.groups ?? []) {
    groups.set(group.id, { id: group.id, name: group.name, branchName: branches.get(group.branchId ?? '') ?? null });
  }
  // Historical groups from this journal's authorised result need not be in today's presence response.
  for (const { group } of entries) {
    if (group && !groups.has(group.id)) groups.set(group.id, group);
  }
  return [...groups.values()].sort((a, b) =>
    (a.branchName ?? '').localeCompare(b.branchName ?? '', 'ru') || a.name.localeCompare(b.name, 'ru'));
}

export function StaffGroupSelect({ groups, selected, onSelect }: {
  groups: StaffGroup[];
  selected: StaffGroup | undefined;
  onSelect: (selection: StaffGroup | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const c = usePalette();
  const styles = useStyles();
  if (groups.length < 2 && !selected) return null;

  const label = selected && selected.branchName && groups.some(other => other.id !== selected.id && other.name === selected.name)
    ? `${selected.name} · ${selected.branchName}` : selected?.name ?? 'Все группы';
  const sections: SheetSection[] = [{
    key: 'all', title: '', data: [{ key: 'all', label: 'Все группы', selected: !selected, onPress: () => onSelect(undefined) }],
  }];
  const multipleBranches = new Set(groups.map(group => group.branchName)).size > 1;
  const branches = new Map<string, SheetSection>();
  for (const group of groups) {
    const branch = group.branchName ?? '';
    if (!branches.has(branch)) branches.set(branch, { key: `branch-${branch}`, title: multipleBranches ? branch : '', data: [] });
    branches.get(branch)!.data.push({
      key: group.id, label: group.name, selected: selected?.id === group.id, onPress: () => onSelect(group),
    });
  }
  sections.push(...branches.values());

  return (
    <View style={styles.band}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Выбрать группу: ${label}`}
        accessibilityState={{ expanded: open }} onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
        <IconSymbol name="person.2.fill" size={20} color={c.textSecondary} />
        <Text style={styles.label}>{label}</Text>
        <IconSymbol name="chevron.down" size={20} color={c.textSecondary} />
      </Pressable>
      <OptionSheet visible={open} title="Группы" sections={sections} onClose={() => setOpen(false)} />
    </View>
  );
}

const useStyles = makeStyles(c => StyleSheet.create({
  band: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: space.lg, paddingTop: space.md },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: controlHeight.touch, gap: space.md,
    backgroundColor: c.card, borderRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.sm },
  pressed: { backgroundColor: c.primarySoft },
  label: { flex: 1, fontSize: typeSize.body, color: c.text, fontWeight: '600' },
}));
