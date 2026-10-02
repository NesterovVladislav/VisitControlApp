import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useGardenStyles } from '../../../components/garden-styles';
import OptionSheet, { SheetSection } from '../../../components/option-sheet';
import { IconSymbol } from '../../../components/ui/icon-symbol';
import { LoadState, useVisitListStyles } from '../../../components/visit-list';
import { useAppDispatch, useAppSelector } from '../../../store';
import { assignChild, loadGroupPeople, loadMoreGroupPeople } from '../../../store/reducers/group-people';
import { Person } from '../../../store/types/people';
import { ageLabel, personName } from '../../../utils/people-format';
import { OTHER_GROUPS_ID, findGroup, groupsOf } from '../../../utils/presence';
import { makeStyles, usePalette } from '../../../hooks/use-palette';

/** Задержка поиска после ввода: не отправляем запрос на каждую букву. */
const SEARCH_DELAY_MS = 300;

/**
 * «Дети без группы»: все активные дети без группы, распределить по группам не открывая каждую группу.
 * Нужен в начале года и после подтверждения заявок. Добавление без подтверждения: у ребёнка без группы
 * ничего не теряется. Распределённый ребёнок уходит из списка.
 */
export default function WithoutGroupScreen() {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const gardenStyles = useGardenStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const presence = useAppSelector((state) => state.visits.present.data);
  const { query, items, status, last, loadingMore, loadMoreFailed, saving, failed } = useAppSelector(
    (state) => state.groupPeople
  );
  const [text, setText] = useState('');
  const [choosingFor, setChoosingFor] = useState<Person | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBranch = presence.branches.length > 1;

  useEffect(() => {
    dispatch(loadGroupPeople({ query: { kind: 'withoutGroup', q: '' } }));
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [dispatch]);

  function changeText(value: string) {
    setText(value);
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      dispatch(loadGroupPeople({ query: { kind: 'withoutGroup', q: value.trim() } }));
    }, SEARCH_DELAY_MS);
  }

  // Группы для выбора: по филиалам, если их несколько
  const sections = useMemo<SheetSection[]>(() => {
    if (!choosingFor) {
      return [];
    }
    const child = choosingFor;
    const option = (groupId: string, label: string) => ({
      key: groupId,
      label,
      onPress: () => {
        const group = findGroup(presence, groupId);
        if (group) {
          dispatch(assignChild({ child, group }));
        }
      },
    });
    const byBranch = [...presence.branches, { id: OTHER_GROUPS_ID, name: 'Другие группы' }]
      .map((branch) => ({
        key: branch.id,
        title: showBranch || branch.id === OTHER_GROUPS_ID ? branch.name : '',
        data: groupsOf(presence, branch.id).map((group) => option(group.id, group.name)),
      }))
      .filter((section) => section.data.length > 0);
    return byBranch;
  }, [choosingFor, presence, showBranch, dispatch]);

  const current = query?.kind === 'withoutGroup';
  const listStatus = current ? status : 'loading';
  const hasGroups = (presence.groups ?? []).length > 0;

  let footer: React.ReactElement | null = null;
  if (current && loadingMore) {
    footer = <ActivityIndicator style={styles.footer} color={c.textTertiary} />;
  } else if (current && loadMoreFailed) {
    footer = (
      <TouchableOpacity style={styles.footer} onPress={() => dispatch(loadMoreGroupPeople())}>
        <Text style={gardenStyles.actionText}>Не удалось загрузить. Повторить</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={gardenStyles.screen}>
      <View style={styles.header}>
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
      </View>

      {listStatus !== 'loaded' ? (
        <LoadState
          status={listStatus}
          onRetry={() => dispatch(loadGroupPeople({ query: { kind: 'withoutGroup', q: text.trim() } }))}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(person) => person.id}
          contentContainerStyle={items.length === 0 ? visitListStyles.emptyContainer : visitListStyles.listContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item, index }) => (
            <View
              style={[
                visitListStyles.row,
                index === 0 && visitListStyles.rowFirst,
                index === items.length - 1 && visitListStyles.rowLast,
              ]}
            >
              <View style={gardenStyles.rowText}>
                <Text style={visitListStyles.rowTitle}>{personName(item)}</Text>
                {failed[item.id] || ageLabel(item.birthDate) ? (
                  <Text style={[gardenStyles.rowSubtitle, failed[item.id] ? styles.error : null]} numberOfLines={2}>
                    {failed[item.id] ?? ageLabel(item.birthDate)}
                  </Text>
                ) : null}
              </View>
              {saving[item.id] ? (
                <ActivityIndicator color={c.textTertiary} />
              ) : hasGroups ? (
                <TouchableOpacity
                  style={styles.choose}
                  onPress={() => setChoosingFor(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`В группу: ${personName(item)}`}
                  hitSlop={4}
                >
                  <Text style={gardenStyles.actionText}>В группу</Text>
                  <IconSymbol name="chevron.down" size={18} color={c.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          onEndReached={() => {
            if (!last && !loadingMore && !loadMoreFailed) {
              dispatch(loadMoreGroupPeople());
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={footer}
          ListEmptyComponent={
            text.trim() ? (
              <Text style={visitListStyles.message}>Никого не нашли</Text>
            ) : (
              <View>
                <Text style={visitListStyles.message}>Все дети в группах</Text>
                <TouchableOpacity style={gardenStyles.action} onPress={() => router.back()} accessibilityRole="button">
                  <Text style={[gardenStyles.actionText, styles.center]}>К филиалам</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}

      <OptionSheet
        visible={choosingFor !== null}
        title={choosingFor ? `${personName(choosingFor)} — в группу` : ''}
        onClose={() => setChoosingFor(null)}
        sections={sections}
      />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
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
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      fontSize: 16,
      color: c.text,
    },
    choose: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    footer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    error: {
      color: c.danger,
    },
    center: {
      textAlign: 'center',
    },
  })
);
