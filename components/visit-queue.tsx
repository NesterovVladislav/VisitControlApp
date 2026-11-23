import Ionicons from '@expo/vector-icons/Ionicons';
import { ActionButton, BottomSheet } from './ui';
import { radius, space } from '../constants/ui-tokens';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RefreshControl } from './ui/refresh-control';
import Avatar from './avatar';
import CommentSheet from './comment-sheet';
import QrScannerSheet from './qr-scanner-sheet';
import { IconSymbol } from './ui/icon-symbol';
import { LoadState, useVisitListStyles } from './visit-list';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { useAppDispatch, useAppSelector } from '../store';
import {
  clearQueueError,
  confirmMarkStart,
  loadQueueStart,
  rejectMarkStart,
  setQueueFilter,
  setQueueShowAll,
} from '../store/reducers/visit-queue';
import { loadPresentStart } from '../store/reducers/visits';
import { isAdminRole } from '../store/types/auth';
import { QueueFilter, VisitQueueItem } from '../store/types/visits';
import { plural } from '../utils/plural';
import {
  filterLabel,
  queueSections,
  queueTime,
  queueWhoLabel,
  REJECT_REASON_MAX_LENGTH,
  REJECT_REASONS,
} from '../utils/visit-queue';

/** Как часто перечитывать очередь, пока она на экране: пуш-уведомлений пока нет */
const QUEUE_POLL_MS = 15_000;

/**
 * Очередь отметок прихода и ухода, которые ждут сотрудника: «Принять», «Отдать» или «Отклонить».
 * Сотрудник видит отметки выбранных им групп; сколько ждут в остальных — строкой под списком.
 */
export default function VisitQueue() {
  const styles = useStyles();
  const c = usePalette();
  const visitListStyles = useVisitListStyles();
  const dispatch = useAppDispatch();
  const { items, otherCount, status, refreshing, filter, showAll, decidingIds, error } = useAppSelector(
    (state) => state.visitQueue,
  );
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const presenceGroups = useAppSelector((state) => state.visits.present.data.groups);
  const groups = useMemo(() => presenceGroups ?? [], [presenceGroups]);
  const allowUngrouped = useAppSelector(state => isAdminRole(state.auth.user?.role));
  const branches = useAppSelector(state => state.visits.present.data.branches);
  const selectableGroups = useMemo(() => groups.map(group => {
    const branch = branches?.find(item => item.id === group.branchId);
    return branch && branches.length > 1 ? { ...group, name: [group.name, branch.name].join(' · ') } : group;
  }), [groups, branches]);
  const showGroupPicker = groups.length > 1 || Boolean(filter || otherCount || (allowUngrouped && groups.length));
  const [pickingGroups, setPickingGroups] = useState(false);
  const [rejecting, setRejecting] = useState<VisitQueueItem | null>(null);
  const [scanning, setScanning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') {
          dispatch(loadQueueStart({ silent: true }));
        }
      }, QUEUE_POLL_MS);
      return () => clearInterval(timer);
    }, [dispatch]),
  );

  useEffect(() => {
    if (error) {
      Alert.alert('Не сохранено', error, [{ text: 'OK', onPress: () => dispatch(clearQueueError()) }]);
    }
  }, [error, dispatch]);

  const sections = useMemo(() => queueSections(items), [items]);

  if (status !== 'loaded') {
    return <LoadState status={status} onRetry={() => dispatch(loadQueueStart())} />;
  }

  const filtered = !showAll && filter !== null;

  return (
    <>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[visitListStyles.listContainer, styles.list]}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => dispatch(loadQueueStart({ refresh: true }))} />
        }
        ListHeaderComponent={
          <View>
            <TouchableOpacity style={styles.scanButton} onPress={() => setScanning(true)} accessibilityRole="button">
              <Ionicons name="qr-code-outline" size={20} color={c.actionPrimary} />
              <Text style={styles.scanButtonText}>Сканировать QR-код родителя</Text>
            </TouchableOpacity>
            {showGroupPicker && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Выбрать группы очереди" style={styles.filterRow} onPress={() => setPickingGroups(true)}>
              <Text style={styles.filterText} numberOfLines={2}>
                {showAll ? 'Все группы' : filterLabel(filter, selectableGroups)}
              </Text>
              <IconSymbol name="chevron.down" size={20} color={c.textSecondary} />
            </TouchableOpacity>}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={visitListStyles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <QueueCard
            item={item}
            deciding={decidingIds.includes(item.id)}
            // Свою отметку сотрудник-родитель подтвердить не может: это делает другой сотрудник
            own={item.representativeId === userId}
            onConfirm={() => dispatch(confirmMarkStart(item.id))}
            onReject={() => setRejecting(item)}
          />
        )}
        ListEmptyComponent={
          <Text style={[visitListStyles.message, styles.empty]}>
            {filtered ? 'В выбранных группах никто не ждёт' : 'Сейчас никто не ждёт'}
          </Text>
        }
        ListFooterComponent={
          filtered && otherCount > 0 ? (
            <TouchableOpacity
              style={styles.other}
              onPress={() => dispatch(setQueueShowAll(true))}
              accessibilityRole="button"
            >
              <Text style={styles.link}>
                Ещё {otherCount} {plural(otherCount, ['ждёт', 'ждут', 'ждут'])} в других группах ›
              </Text>
            </TouchableOpacity>
          ) : showAll && filter !== null ? (
            <TouchableOpacity
              style={styles.other}
              onPress={() => dispatch(setQueueShowAll(false))}
              accessibilityRole="button"
            >
              <Text style={styles.link}>Показать только мои группы</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <GroupPicker
        visible={pickingGroups}
        groups={selectableGroups}
        allowUngrouped={allowUngrouped}
        filter={filter}
        onClose={() => setPickingGroups(false)}
        onApply={(next) => {
          setPickingGroups(false);
          dispatch(setQueueFilter(next));
        }}
      />
      <QrScannerSheet
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={() => {
          // Ребёнок принят или отдан по коду: очередь и «Кто в саду» берём с сервера
          dispatch(loadQueueStart({ silent: true }));
          dispatch(loadPresentStart({ refresh: true }));
        }}
      />
      <CommentSheet
        visible={rejecting !== null}
        title={rejecting?.childName ?? ''}
        message={rejecting?.status === 'OUT' ? 'Отклонить отметку ухода?' : 'Отклонить отметку прихода?'}
        label="Причина — её увидит родитель"
        maxLength={REJECT_REASON_MAX_LENGTH}
        presets={REJECT_REASONS[rejecting?.status ?? 'IN']}
        required
        destructive
        confirmLabel="Отклонить"
        onClose={() => setRejecting(null)}
        onConfirm={(comment) => {
          if (rejecting) {
            dispatch(rejectMarkStart({ id: rejecting.id, comment }));
          }
          setRejecting(null);
        }}
      />
    </>
  );
}


/** «Петя Иванов» или «Иванова А.» — для инициалов в заглушке фотографии. */
function nameParts(name: string): { firstName: string; surname: string } {
  const [surname = '', firstName = ''] = name.split(' ');
  return { firstName, surname };
}
function QueueCard({
  item,
  deciding,
  own,
  onConfirm,
  onReject,
}: {
  item: VisitQueueItem;
  deciding: boolean;
  own: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const c = usePalette();
  const styles = useStyles();
  const arriving = item.status === 'IN';
  const confirmLabel = arriving ? 'Принять' : 'Отдать';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.childPhoto}>
          <Avatar {...nameParts(item.childName)} photoUrl={item.childPhotoUrl} size={44} />
        </View>
        <Text style={styles.childName}>
          {item.childName}
        </Text>
        <Text style={styles.time}>{queueTime(item)}</Text>
      </View>
      <View style={styles.whoRow}>
        {/* Лицо взрослого — чтобы сверить, кто привёл или забирает */}
        {item.representativePhotoUrl ? (
          <View style={styles.whoPhoto}>
            <Avatar {...nameParts(item.representativeName)} photoUrl={item.representativePhotoUrl} size={32} />
          </View>
        ) : null}
        <Text style={[styles.who, styles.whoText]}>{queueWhoLabel(item)}</Text>
      </View>
      {item.comment ? <Text style={styles.comment}>«{item.comment}»</Text> : null}
      {own ? (
        <Text style={styles.ownNote}>Это ваша отметка: её подтвердит другой сотрудник</Text>
      ) : deciding ? (
        <ActivityIndicator style={styles.deciding} color={c.primary} />
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.reject]}
            onPress={onReject}
            accessibilityRole="button"
            accessibilityLabel={`Отклонить: ${item.childName}`}
          >
            <Text style={styles.rejectText}>Отклонить</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.confirm]}
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel={`${confirmLabel}: ${item.childName}`}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/**
 * Выбор своих групп для очереди. Ничего не выбрано — вся очередь.
 */
function GroupPicker({
  visible,
  allowUngrouped,
  groups,
  filter,
  onClose,
  onApply,
}: {
  visible: boolean;
  allowUngrouped: boolean;
  groups: { id: string; name: string }[];
  filter: QueueFilter | null;
  onClose: () => void;
  onApply: (filter: QueueFilter | null) => void;
}) {
  const c = usePalette();
  const styles = useStyles();
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [withoutGroup, setWithoutGroup] = useState(false);

  useEffect(() => {
    if (visible) {
      setGroupIds(filter?.groupIds ?? []);
      setWithoutGroup(allowUngrouped && Boolean(filter?.withoutGroup));
    }
  }, [visible, filter, allowUngrouped]);

  function toggle(id: string) {
    setGroupIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function apply() {
    // Оставляем только существующие группы: удалённые из выбора пропадают
    const known = groupIds.filter((id) => groups.some((group) => group.id === id));
    onApply(known.length === 0 && !withoutGroup ? null : { groupIds: known, withoutGroup });
  }

  const rows = [
    ...groups.map((group) => ({
      key: group.id,
      label: group.name,
      selected: groupIds.includes(group.id),
      onPress: () => toggle(group.id),
    })),
    ...(allowUngrouped ? [{
      key: 'without-group',
      label: 'Без группы',
      selected: withoutGroup,
      onPress: () => setWithoutGroup((current) => !current),
    }] : []),
  ];

  return (
    visible ? <BottomSheet title="Мои группы" onClose={onClose}
      footer={<ActionButton label="Готово" onPress={apply} />}>
        <Text style={styles.sheetHint}>Выберите группы для очереди. Пустой выбор показывает все доступные группы.</Text>
        <View>
          {rows.map((row) => (
            <TouchableOpacity
              key={row.key}
              style={styles.option}
              onPress={row.onPress}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: row.selected }}
            >
              <Text style={styles.optionText}>{row.label}</Text>
              {row.selected ? <IconSymbol name="checkmark" size={20} color={c.primary} /> : null}
            </TouchableOpacity>
          ))}
        </View>
    </BottomSheet> : null
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    list: { maxWidth: 480, paddingHorizontal: space.lg, paddingTop: space.md },
    scanButton: {
      flexDirection: 'row', gap: space.sm,
      minHeight: 46,
      marginBottom: space.sm,
      borderRadius: radius.card,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.card,
    },
    scanButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.actionPrimary,
    },
    filterRow: {
      minHeight: 46, paddingHorizontal: space.lg, backgroundColor: c.card, borderRadius: radius.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    filterText: {
      flex: 1,
      marginRight: 12,
      fontSize: 14,
      color: c.textSecondary,
    },
    link: {
      color: c.primary,
      fontSize: 15,
      fontWeight: '500',
    },
    empty: {
      marginTop: 32,
    },
    other: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 16,
      marginBottom: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    childPhoto: {
      marginRight: 10,
    },
    whoRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    whoPhoto: {
      marginRight: 8,
    },
    whoText: {
      flex: 1,
    },
    childName: {
      flex: 1,
      marginRight: 12,
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
    },
    time: {
      fontSize: 15,
      color: c.textSecondary,
    },
    who: {
      marginTop: 4,
      fontSize: 14,
      color: c.textSecondary,
    },
    comment: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 19,
      color: c.text,
    },
    ownNote: {
      marginTop: 12,
      fontSize: 13,
      color: c.warning,
    },
    deciding: {
      marginTop: 12,
      minHeight: 44,
    },
    actions: {
      flexDirection: 'row',
      marginTop: 12,
    },
    button: {
      flex: 1,
      minHeight: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reject: {
      marginRight: 10,
      backgroundColor: c.fill,
    },
    rejectText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.actionPrimary,
    },
    confirm: {
      backgroundColor: c.actionPrimary,
    },
    confirmText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.onActionPrimary,
    },
    sheetHint: {
      marginTop: 6,
      marginBottom: 12,
      fontSize: 13,
      lineHeight: 18,
      color: c.textTertiary,
    },
    option: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: c.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    optionText: {
      fontSize: 16,
      color: c.text,
    },
  }),
);
