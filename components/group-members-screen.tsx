import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import SegmentedControl from './segmented-control';
import { IconSymbol } from './ui/icon-symbol';
import { LoadState, useVisitListStyles } from './visit-list';
import { useAppDispatch, useAppSelector } from '../store';
import {
  loadCandidates,
  loadMoreCandidates,
  putChildInGroup,
  removeChildFromGroup,
} from '../store/reducers/group-membership';
import { isAdminRole } from '../store/types/auth';
import { CandidateFilter } from '../store/types/group-membership';
import { Person, PersonGroup } from '../store/types/people';
import { childSubtitle, personName } from '../utils/people-format';
import { findGroup } from '../utils/presence';
import { makeStyles, usePalette } from '../hooks/use-palette';

const FILTER_OPTIONS: { value: CandidateFilter; label: string }[] = [
  { value: 'inGroup', label: 'В группе' },
  { value: 'withoutGroup', label: 'Без группы' },
  { value: 'all', label: 'Все дети' },
];

/** Задержка поиска после ввода: не отправляем запрос на каждую букву. */
const SEARCH_DELAY_MS = 300;

/**
 * Состав группы из «Посещения»: «В группе» — дети группы, их можно убрать; «Без группы» и «Все дети» — добавить
 * (в том числе в пустую группу) или перевести из другой. Ребёнок состоит в одной группе.
 * Перевод и удаление — только после подтверждения, удаление — отдельной кнопкой «Убрать», а не нажатием на строку,
 * чтобы ребёнка нельзя было убрать случайно. Экран остаётся открытым: детей обычно добавляют по нескольку подряд.
 */
export default function GroupMembersScreen() {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const presence = useAppSelector((state) => state.visits.present.data);
  const isAdmin = useAppSelector((state) => isAdminRole(state.auth.user?.role));
  const { filter, q, items, status, last, loadingMore, loadMoreFailed, saving, failed } = useAppSelector(
    (state) => state.groupMembership
  );
  const [text, setText] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Группу берём из уже загруженного «Кто в саду»: экран открывается только оттуда
  const group = useMemo(() => findGroup(presence, groupId), [presence, groupId]);
  const groupRef = useRef(group);
  groupRef.current = group;
  const showBranch = presence.branches.length > 1;

  // Открытие экрана: в группе есть дети — показываем их, в пустой группе — сразу детей без группы
  useEffect(() => {
    if (groupRef.current) {
      const hasChildren = (presence.groups ?? []).some((item) => item.id === groupId && item.totalChildren > 0);
      dispatch(loadCandidates({ group: groupRef.current, filter: hasChildren ? 'inGroup' : 'withoutGroup', q: '' }));
    }
    // presence не в зависимостях: после каждого добавления «Кто в саду» перечитывается, а список сбрасывать не нужно
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, groupId]);

  useEffect(() => () => cancelSearch(), []);

  function cancelSearch() {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }

  function reload(next: { filter?: CandidateFilter; q?: string }) {
    if (groupRef.current) {
      dispatch(loadCandidates({ group: groupRef.current, filter: next.filter ?? filter, q: next.q ?? text }));
    }
  }

  function changeText(value: string) {
    setText(value);
    cancelSearch();
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      reload({ q: value });
    }, SEARCH_DELAY_MS);
  }

  function selectFilter(value: CandidateFilter) {
    cancelSearch();
    reload({ filter: value });
  }

  function add(child: Person, target: PersonGroup) {
    if (!child.group) {
      dispatch(putChildInGroup(child));
      return;
    }
    Alert.alert(
      `Перевести в «${target.name}»?`,
      `${personName(child)} сейчас в группе «${child.group.name}».`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Перевести', onPress: () => dispatch(putChildInGroup(child)) },
      ]
    );
  }

  function remove(child: Person, target: PersonGroup) {
    Alert.alert(
      `Убрать из группы «${target.name}»?`,
      `${personName(child)} останется без группы и пропадёт из этой группы в «Кто в саду». ` +
        'Вернуть можно здесь же, на вкладке «Без группы».',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Убрать', style: 'destructive', onPress: () => dispatch(removeChildFromGroup(child)) },
      ],
      { cancelable: true }
    );
  }

  const done = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Готово</Text>
          </TouchableOpacity>
        ),
      }}
    />
  );

  // Экран недоступен сотруднику; группу могли удалить, пока экран был открыт
  if (!isAdmin || !group) {
    return (
      <View style={visitListStyles.center}>
        {done}
        <Text style={visitListStyles.message}>{isAdmin ? 'Группа не найдена' : 'Менять состав группы может администратор'}</Text>
      </View>
    );
  }

  let footer: React.ReactElement | null = null;
  if (loadingMore) {
    footer = <ActivityIndicator style={styles.footer} color={c.textTertiary} />;
  } else if (loadMoreFailed) {
    footer = (
      <TouchableOpacity style={styles.footer} onPress={() => dispatch(loadMoreCandidates())}>
        <Text style={styles.link}>Не удалось загрузить. Повторить</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.screen}>
      {done}
      <View style={styles.header}>
        <Text style={styles.target}>
          {showBranch && group.branchName ? `«${group.name}» · ${group.branchName}` : `Группа «${group.name}»`}
        </Text>
        <View style={styles.search}>
          <IconSymbol name="magnifyingglass" size={20} color={c.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={text}
            onChangeText={changeText}
            placeholder="Фамилия, имя"
            placeholderTextColor={c.placeholder}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Поиск"
          />
          {text ? (
            <TouchableOpacity onPress={() => changeText('')} accessibilityLabel="Очистить поиск" hitSlop={8}>
              <IconSymbol name="xmark.circle.fill" size={20} color={c.iconMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <SegmentedControl options={FILTER_OPTIONS} value={filter} onChange={selectFilter} />
      </View>

      {status !== 'loaded' ? (
        <LoadState status={status} onRetry={() => reload({})} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(person) => person.id}
          contentContainerStyle={items.length === 0 ? visitListStyles.emptyContainer : styles.listContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item, index }) => (
            <CandidateRow
              child={item}
              groupId={group.id}
              showBranch={showBranch}
              saving={Boolean(saving[item.id])}
              error={failed[item.id] ?? null}
              first={index === 0}
              last={index === items.length - 1}
              onAdd={() => add(item, group)}
              onRemove={() => remove(item, group)}
            />
          )}
          onEndReached={() => {
            if (!last && !loadingMore && !loadMoreFailed) {
              dispatch(loadMoreCandidates());
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={footer}
          ListEmptyComponent={<Text style={visitListStyles.message}>{emptyText(filter, q)}</Text>}
        />
      )}
    </View>
  );
}

function emptyText(filter: CandidateFilter, q: string): string {
  if (q.trim()) {
    return 'Никого не нашли';
  }
  switch (filter) {
    case 'inGroup':
      return 'В группе пока нет детей. Добавьте их на вкладке «Без группы»';
    case 'withoutGroup':
      return 'Все дети уже в группах. Чтобы перевести ребёнка из другой группы, откройте «Все дети»';
    case 'all':
      return 'Детей пока нет';
  }
}

function CandidateRow({
  child,
  groupId,
  showBranch,
  saving,
  error,
  first,
  last,
  onAdd,
  onRemove,
}: {
  child: Person;
  groupId: string;
  showBranch: boolean;
  saving: boolean;
  error: string | null;
  first: boolean;
  last: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  // Нажатие на строку только добавляет; убрать можно лишь кнопкой «Убрать» с подтверждением
  const inGroup = child.group?.id === groupId;

  let action: React.ReactElement;
  if (saving) {
    action = <ActivityIndicator color={c.textTertiary} />;
  } else if (inGroup) {
    action = (
      <TouchableOpacity
        style={styles.remove}
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Убрать из группы: ${personName(child)}`}
        hitSlop={4}
      >
        <Text style={styles.removeText}>Убрать</Text>
      </TouchableOpacity>
    );
  } else {
    action = <IconSymbol name="plus.circle.fill" size={24} color={c.primary} />;
  }

  const rowStyle = [visitListStyles.row, first && visitListStyles.rowFirst, last && visitListStyles.rowLast];
  const text = (
    <View style={styles.rowText}>
      <Text style={visitListStyles.rowTitle}>{personName(child)}</Text>
      <Text style={[styles.rowSubtitle, error ? styles.error : null]} numberOfLines={2}>
        {error ?? childSubtitle(child, showBranch)}
      </Text>
    </View>
  );

  // Ребёнок группы: строка не нажимается, чтобы случайное касание ничего не меняло
  if (inGroup) {
    return (
      <View style={rowStyle}>
        {text}
        {action}
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={rowStyle}
      onPress={onAdd}
      disabled={saving}
      accessibilityRole="button"
      accessibilityState={{ disabled: saving }}
      accessibilityLabel={`Добавить: ${personName(child)}`}
    >
      {text}
      {action}
    </TouchableOpacity>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 4,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    target: {
      fontSize: 15,
      color: c.textSecondary,
      marginBottom: 12,
    },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      fontSize: 16,
      color: c.text,
    },
    listContainer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    rowText: {
      flex: 1,
      marginRight: 12,
    },
    rowSubtitle: {
      marginTop: 2,
      fontSize: 13,
      color: c.textSecondary,
    },
    error: {
      color: c.danger,
    },
    remove: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.danger,
    },
    removeText: {
      fontSize: 14,
      color: c.danger,
    },
    footer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    link: {
      color: c.primary,
      fontSize: 16,
    },
  })
);
