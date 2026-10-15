import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RefreshControl } from '../../../components/ui/refresh-control';
import SegmentedControl from '../../../components/segmented-control';
import Avatar from '@/components/avatar';
import LinkChildSheet from '../../../components/link-child-sheet';
import { IconSymbol } from '../../../components/ui/icon-symbol';
import { LoadState, useVisitListStyles } from '../../../components/visit-list';
import { useAppDispatch, useAppSelector } from '../../../store';
import {
  clearPasswordReset,
  loadMorePeople,
  loadPeople,
  loadPeopleFilters,
  resetPersonPassword,
} from '../../../store/reducers/people';
import { openChildLink } from '../../../store/reducers/child-link';
import { isAdminRole, outranks } from '../../../store/types/auth';
import {
  GardenGroup,
  PasswordReset,
  PeopleCategory,
  PeopleGroupFilter,
  Person,
} from '../../../store/types/people';
import {
  childSubtitle,
  countLabel,
  emptyLabel,
  parentSubtitle,
  personName,
  staffSubtitle,
} from '../../../utils/people-format';
import { makeStyles, usePalette } from '../../../hooks/use-palette';

const CATEGORY_OPTIONS: { value: PeopleCategory; label: string }[] = [
  { value: 'CHILD', label: 'Дети' },
  { value: 'PARENT', label: 'Родители' },
  { value: 'STAFF', label: 'Сотрудники' },
];

/** Задержка поиска после ввода: не отправляем запрос на каждую букву. */
const SEARCH_DELAY_MS = 300;

/**
 * Вкладка «Люди»: дети, родители и сотрудники сада из GET /user/people (docs/admin-screens.md, «Люди»).
 * Поиск общий для всех групп и сохраняется при переключении. Карточек и создания людей пока нет.
 * Администратор сбрасывает пароль родителю или сотруднику кнопкой 🔑 в строке, с подтверждением,
 * и привязывает ко взрослому ребёнка сада кнопкой 🔗.
 */
export default function PeopleScreen() {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const dispatch = useAppDispatch();
  const { query, items, total, status, refreshing, last, loadingMore, loadMoreFailed, filterOptions, passwordReset } =
    useAppSelector((state) => state.people);
  const viewer = useAppSelector((state) => state.auth.user);
  const [text, setText] = useState(query.q);
  const [filterOpen, setFilterOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Актуальный запрос для отложенного поиска: группу могли сменить, пока шёл таймер
  const queryRef = useRef(query);
  queryRef.current = query;

  // Первое открытие вкладки. При возврате на вкладку список не перезагружаем — для этого «потянуть вниз»
  useEffect(() => {
    dispatch(loadPeople());
    dispatch(loadPeopleFilters());
  }, [dispatch]);

  useEffect(() => () => cancelSearch(), []);

  // Результат сброса пароля — диалогом, один раз
  useEffect(() => {
    if (!passwordReset || passwordReset.status === 'pending') {
      return;
    }
    const message = passwordResetMessage(passwordReset);
    if (message) {
      Alert.alert(message.title, message.text);
    }
    dispatch(clearPasswordReset());
  }, [passwordReset, dispatch]);

  function canResetPassword(person: Person): boolean {
    return (
      query.category !== 'CHILD' &&
      !!viewer &&
      isAdminRole(viewer.role) &&
      person.id !== viewer.id &&
      !!person.email &&
      outranks(viewer.role, person.role)
    );
  }

  const canLinkChild = query.category !== 'CHILD' && isAdminRole(viewer?.role);

  function confirmResetPassword(person: Person) {
    Alert.alert(
      'Сбросить пароль?',
      `${personName(person)} получит новый пароль на ${person.email}. Старый пароль перестанет работать.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Сбросить', style: 'destructive', onPress: () => dispatch(resetPersonPassword(person.id)) },
      ],
      { cancelable: true }
    );
  }

  function cancelSearch() {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }

  // Поиск с задержкой: запрос уходит, когда пользователь перестал печатать
  function changeText(value: string) {
    setText(value);
    cancelSearch();
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      dispatch(loadPeople({ query: { ...queryRef.current, q: value } }));
    }, SEARCH_DELAY_MS);
  }

  const showBranch = filterOptions.branches.length > 1;

  function selectCategory(category: PeopleCategory) {
    cancelSearch();
    dispatch(loadPeople({ query: { ...query, category, q: text } }));
  }

  function selectGroupFilter(groupFilter: PeopleGroupFilter) {
    setFilterOpen(false);
    cancelSearch();
    dispatch(loadPeople({ query: { ...query, q: text, groupFilter } }));
  }

  function loadMore() {
    if (!last && !loadingMore && !loadMoreFailed) {
      dispatch(loadMorePeople());
    }
  }

  let footer: React.ReactElement | null = null;
  if (loadingMore) {
    footer = <ActivityIndicator style={styles.footer} color={c.textTertiary} />;
  } else if (loadMoreFailed) {
    footer = (
      <TouchableOpacity style={styles.footer} onPress={() => dispatch(loadMorePeople())}>
        <Text style={styles.link}>Не удалось загрузить. Повторить</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.search}>
          <IconSymbol name="magnifyingglass" size={20} color={c.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={text}
            onChangeText={changeText}
            placeholder={query.category === 'CHILD' ? 'Фамилия, имя' : 'Фамилия, телефон, email'}
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
        <SegmentedControl options={CATEGORY_OPTIONS} value={query.category} onChange={selectCategory} />
        {query.category === 'CHILD' ? (
          <TouchableOpacity
            style={styles.filterChip}
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Фильтр по группе: ${groupFilterLabel(query.groupFilter)}`}
          >
            <Text style={styles.filterText}>{groupFilterLabel(query.groupFilter)}</Text>
            <IconSymbol name="chevron.down" size={18} color={c.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {status !== 'loaded' ? (
        <LoadState status={status} onRetry={() => dispatch(loadPeople())} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(person) => person.id}
          contentContainerStyle={items.length === 0 ? visitListStyles.emptyContainer : styles.listContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => dispatch(loadPeople({ refresh: true }))} />
          }
          ListHeaderComponent={
            items.length > 0 ? <Text style={styles.count}>{countLabel(query.category, total)}</Text> : null
          }
          renderItem={({ item, index }) => (
            <PersonRow
              person={item}
              category={query.category}
              showBranch={showBranch}
              first={index === 0}
              last={index === items.length - 1}
              canResetPassword={canResetPassword(item)}
              resettingPassword={passwordReset?.personId === item.id && passwordReset.status === 'pending'}
              onResetPassword={() => confirmResetPassword(item)}
              onLinkChild={canLinkChild ? () => dispatch(openChildLink(item)) : null}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={footer}
          ListEmptyComponent={<Text style={visitListStyles.message}>{emptyLabel(query.category, query.q)}</Text>}
        />
      )}

      <GroupFilterModal
        visible={filterOpen}
        current={query.groupFilter}
        groups={filterOptions.groups}
        branches={filterOptions.branches}
        loading={filterOptions.status === 'loading'}
        failed={filterOptions.status === 'failed'}
        onRetry={() => dispatch(loadPeopleFilters())}
        onSelect={selectGroupFilter}
        onClose={() => setFilterOpen(false)}
      />

      <LinkChildSheet showBranch={showBranch} />
    </View>
  );
}

function groupFilterLabel(filter: PeopleGroupFilter): string {
  switch (filter.kind) {
    case 'all':
      return 'Все группы';
    case 'withoutGroup':
      return 'Без группы';
    case 'group':
      return filter.name;
  }
}

/** Текст диалога с результатом сброса пароля; null — показывать нечего. */
function passwordResetMessage(reset: PasswordReset): { title: string; text?: string } | null {
  switch (reset.status) {
    case 'sent':
      return { title: 'Пароль сброшен', text: 'Новый пароль отправлен на email пользователя.' };
    case 'notSent':
      return {
        title: 'Пароль сброшен, но письмо не отправлено',
        text: 'Старый пароль уже не работает. Сбросьте пароль ещё раз, чтобы отправить письмо повторно.',
      };
    case 'failed':
      return reset.message ? { title: 'Пароль не сброшен', text: reset.message } : null;
    default:
      return null;
  }
}

function PersonRow({
  person,
  category,
  showBranch,
  first,
  last,
  canResetPassword,
  resettingPassword,
  onResetPassword,
  onLinkChild,
}: {
  person: Person;
  category: PeopleCategory;
  showBranch: boolean;
  first: boolean;
  last: boolean;
  canResetPassword: boolean;
  resettingPassword: boolean;
  onResetPassword: () => void;
  /** null — кнопки привязки ребёнка нет */
  onLinkChild: (() => void) | null;
}) {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const subtitle =
    category === 'CHILD'
      ? childSubtitle(person, showBranch)
      : category === 'PARENT'
        ? parentSubtitle(person)
        : staffSubtitle(person);
  const phone = category === 'CHILD' ? null : person.phone;

  return (
    <View style={[visitListStyles.row, first && visitListStyles.rowFirst, last && visitListStyles.rowLast]}>
      {category === 'CHILD' ? (
        <View
          style={[visitListStyles.dot, person.present ? visitListStyles.dotIn : styles.dotAway]}
          accessibilityLabel={person.present ? 'В саду' : 'Не в саду'}
        />
      ) : null}
      <View style={styles.rowPhoto}>
        <Avatar firstName={person.firstName} surname={person.surname} photoUrl={person.photoUrl} size={36} />
      </View>
      <View style={styles.rowText}>
        <Text style={visitListStyles.rowTitle}>{personName(person)}</Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onLinkChild ? (
        <TouchableOpacity
          style={styles.action}
          onPress={onLinkChild}
          accessibilityRole="button"
          accessibilityLabel={`Привязать ребёнка: ${personName(person)}`}
          hitSlop={8}
        >
          <IconSymbol name="link" size={20} color={c.primary} />
        </TouchableOpacity>
      ) : null}
      {resettingPassword ? (
        <ActivityIndicator style={styles.action} color={c.textTertiary} accessibilityLabel="Сбрасываем пароль" />
      ) : canResetPassword ? (
        <TouchableOpacity
          style={styles.action}
          onPress={onResetPassword}
          accessibilityRole="button"
          accessibilityLabel={`Сбросить пароль: ${personName(person)}`}
          hitSlop={8}
        >
          <IconSymbol name="key.fill" size={20} color={c.primary} />
        </TouchableOpacity>
      ) : null}
      {phone ? (
        <TouchableOpacity
          style={styles.action}
          onPress={() => Linking.openURL(`tel:${phone}`)}
          accessibilityRole="button"
          accessibilityLabel={`Позвонить: ${personName(person)}`}
          hitSlop={8}
        >
          <IconSymbol name="phone.fill" size={20} color={c.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

interface FilterSection {
  key: string;
  title: string;
  data: { key: string; label: string; filter: PeopleGroupFilter }[];
}

/**
 * Выбор группы детей: «Все группы», «Без группы», затем группы — по филиалам, если филиалов несколько.
 */
function GroupFilterModal({
  visible,
  current,
  groups,
  branches,
  loading,
  failed,
  onRetry,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: PeopleGroupFilter;
  groups: GardenGroup[];
  branches: { id: string; name: string }[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onSelect: (filter: PeopleGroupFilter) => void;
  onClose: () => void;
}) {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const sections = useMemo<FilterSection[]>(() => {
    const toItem = (group: GardenGroup) => ({
      key: group.id,
      label: group.name,
      filter: { kind: 'group', id: group.id, name: group.name } as PeopleGroupFilter,
    });
    const result: FilterSection[] = [
      {
        key: 'common',
        title: '',
        data: [
          { key: 'all', label: 'Все группы', filter: { kind: 'all' } },
          { key: 'without', label: 'Без группы', filter: { kind: 'withoutGroup' } },
        ],
      },
    ];
    if (branches.length > 1) {
      for (const branch of branches) {
        const branchGroups = groups.filter((group) => group.branchId === branch.id);
        if (branchGroups.length > 0) {
          result.push({ key: branch.id, title: branch.name, data: branchGroups.map(toItem) });
        }
      }
      const known = new Set(branches.map((branch) => branch.id));
      const other = groups.filter((group) => !group.branchId || !known.has(group.branchId));
      if (other.length > 0) {
        result.push({ key: 'other', title: 'Другие группы', data: other.map(toItem) });
      }
    } else if (groups.length > 0) {
      result.push({ key: 'groups', title: 'Группы', data: groups.map(toItem) });
    }
    return result;
  }, [groups, branches]);

  const isCurrent = (filter: PeopleGroupFilter) =>
    filter.kind === current.kind && (filter.kind !== 'group' || (current.kind === 'group' && filter.id === current.id));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Группа</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Готово</Text>
          </TouchableOpacity>
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            section.title ? <Text style={visitListStyles.sectionTitle}>{section.title.toUpperCase()}</Text> : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.option}
              onPress={() => onSelect(item.filter)}
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent(item.filter) }}
            >
              <Text style={styles.optionText}>{item.label}</Text>
              {isCurrent(item.filter) ? <IconSymbol name="checkmark" size={20} color={c.primary} /> : null}
            </TouchableOpacity>
          )}
          ListFooterComponent={
            loading ? (
              <ActivityIndicator style={styles.footer} color={c.textTertiary} />
            ) : failed ? (
              <TouchableOpacity style={styles.footer} onPress={onRetry}>
                <Text style={styles.link}>Не удалось загрузить группы. Повторить</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </View>
    </Modal>
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
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
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
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingVertical: 6,
    },
    filterText: {
      fontSize: 15,
      color: c.primary,
      marginRight: 2,
    },
    listContainer: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 24,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    count: {
      fontSize: 15,
      color: c.textSecondary,
      marginBottom: 8,
    },
    rowPhoto: {
      marginRight: 10,
    },
    rowText: {
      flex: 1,
    },
    rowSubtitle: {
      marginTop: 2,
      fontSize: 13,
      color: c.textSecondary,
    },
    dotAway: {
      borderWidth: 1.5,
      borderColor: c.iconMuted,
    },
    action: {
      marginLeft: 12,
      padding: 6,
    },
    footer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    link: {
      color: c.primary,
      fontSize: 15,
    },
    backdrop: {
      flex: 1,
      backgroundColor: c.overlay,
    },
    sheet: {
      maxHeight: '70%',
      backgroundColor: c.background,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
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
  })
);
