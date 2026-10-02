import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useGardenStyles } from '../../../../components/garden-styles';
import OptionSheet, { SheetOption } from '../../../../components/option-sheet';
import SegmentedControl from '../../../../components/segmented-control';
import { IconSymbol } from '../../../../components/ui/icon-symbol';
import { LoadState, useVisitListStyles } from '../../../../components/visit-list';
import { useGardenEdit } from '../../../../hooks/use-garden-edit';
import { useOpenGroupMembers } from '../../../../hooks/use-open-group-members';
import { useAppDispatch, useAppSelector } from '../../../../store';
import { loadGroupPeople, loadMoreGroupPeople } from '../../../../store/reducers/group-people';
import { loadPresentStart } from '../../../../store/reducers/visits';
import { Person } from '../../../../store/types/people';
import { findPresenceGroup, gardenErrorMessage, notEmptyMessage } from '../../../../utils/garden';
import { ageLabel, parentSubtitle, personName } from '../../../../utils/people-format';
import { makeStyles, usePalette } from '../../../../hooks/use-palette';

type Tab = 'CHILD' | 'PARENT';

/**
 * Группа в «Саде»: дети (● в саду) и родители детей группы с кнопкой звонка. Состав меняется на общем экране
 * «Состав группы», здесь удалить ребёнка нельзя. Меню «⋯»: переименовать, перенести в другой филиал, удалить пустую.
 */
export default function GardenGroupScreen() {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const gardenStyles = useGardenStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const presence = useAppSelector((state) => state.visits.present);
  const people = useAppSelector((state) => state.groupPeople);
  const [tab, setTab] = useState<Tab>('CHILD');
  const [sheet, setSheet] = useState<'menu' | 'move' | null>(null);
  const openMembers = useOpenGroupMembers('garden');

  const group = useMemo(() => findPresenceGroup(presence.data, id), [presence.data, id]);
  const branches = presence.data.branches;
  const branch = branches.find((item) => item.id === group?.branchId) ?? null;

  // При каждом возврате: после «Состава группы» и отметок родителей список меняется
  useFocusEffect(
    useCallback(() => {
      dispatch(loadPresentStart());
      dispatch(loadGroupPeople({ query: { kind: 'group', groupId: id, category: tab } }));
    }, [dispatch, id, tab])
  );

  // Удалили группу отсюда — возвращаемся к филиалу
  const deleting = useRef(false);
  const { run } = useGardenEdit({
    onDone: () => {
      if (deleting.current) {
        router.back();
      }
    },
    onError: (error, action) => {
      deleting.current = false;
      if (action.type === 'deleteGroup' && error.kind === 'notEmpty') {
        askToEmpty(error.count);
        return;
      }
      if (action.type === 'saveGroup' && error.kind === 'nameTaken') {
        const target = branches.find((item) => item.id === action.branchId)?.name ?? '';
        Alert.alert('Не удалось перенести', `В филиале «${target}» уже есть группа «${action.name}». Сначала переименуйте одну из них`);
        return;
      }
      Alert.alert('Не удалось сохранить', gardenErrorMessage(error, 'group', group?.name ?? ''));
    },
  });

  function askToEmpty(count: number | null) {
    Alert.alert('Нельзя удалить группу', notEmptyMessage('group', group?.name ?? '', count), [
      { text: 'Отмена', style: 'cancel' },
      ...(openMembers ? [{ text: 'Изменить состав', onPress: () => openMembers(id) }] : []),
    ]);
  }

  function confirmDelete() {
    if (!group) {
      return;
    }
    if (group.totalChildren > 0) {
      askToEmpty(group.totalChildren);
      return;
    }
    Alert.alert(`Удалить группу «${group.name}»?`, undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          deleting.current = true;
          run({ type: 'deleteGroup', id });
        },
      },
    ]);
  }

  if (presence.status !== 'loaded') {
    return <LoadState status={presence.status} onRetry={() => dispatch(loadPresentStart())} />;
  }

  // Группу удалили на другом устройстве, пока экран был открыт
  if (!group) {
    return (
      <View style={visitListStyles.center}>
        <Stack.Screen options={{ title: 'Группа' }} />
        <Text style={visitListStyles.message}>Группа не найдена</Text>
        <TouchableOpacity style={gardenStyles.action} onPress={() => router.back()} accessibilityRole="button">
          <Text style={gardenStyles.actionText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Переименовать можно только группу в известном филиале: сервер требует филиал вместе с названием
  const menu: SheetOption[] = [
    ...(branch
      ? [
          {
            key: 'rename',
            label: 'Переименовать',
            onPress: () => router.push({ pathname: '/garden/name', params: { kind: 'group', id } }),
          },
        ]
      : []),
    ...(branches.some((item) => item.id !== group.branchId)
      ? [{ key: 'move', label: branch ? 'Перенести в другой филиал' : 'Перенести в филиал', onPress: () => setSheet('move') }]
      : []),
    { key: 'delete', label: 'Удалить группу', destructive: true, onPress: confirmDelete },
  ];

  const moveOptions: SheetOption[] = branches
    .filter((item) => item.id !== group.branchId)
    .map((item) => ({
      key: item.id,
      label: item.name,
      onPress: () => run({ type: 'saveGroup', id, name: group.name, branchId: item.id }),
    }));

  const current = people.query?.kind === 'group' && people.query.groupId === id && people.query.category === tab;
  const status = current ? people.status : 'loading';
  const items = current ? people.items : [];

  let footer: React.ReactElement | null = null;
  if (current && people.loadingMore) {
    footer = <ActivityIndicator style={styles.footer} color={c.textTertiary} />;
  } else if (current && people.loadMoreFailed) {
    footer = (
      <TouchableOpacity style={styles.footer} onPress={() => dispatch(loadMoreGroupPeople())}>
        <Text style={gardenStyles.actionText}>Не удалось загрузить. Повторить</Text>
      </TouchableOpacity>
    );
  } else if (tab === 'CHILD' && items.length > 0 && openMembers) {
    footer = (
      <TouchableOpacity style={gardenStyles.action} onPress={() => openMembers(id)} accessibilityRole="button">
        <Text style={gardenStyles.actionText}>Изменить состав</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={gardenStyles.screen}>
      <Stack.Screen
        options={{
          title: group.name,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setSheet('menu')}
              accessibilityRole="button"
              accessibilityLabel="Меню группы"
              hitSlop={8}
              style={gardenStyles.headerIcon}
            >
              <IconSymbol name="ellipsis" size={24} color={c.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.header}>
        <SegmentedControl
          options={[
            { value: 'CHILD', label: `Дети · ${group.totalChildren}` },
            { value: 'PARENT', label: 'Родители' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {status !== 'loaded' ? (
        <LoadState
          status={status}
          onRetry={() => dispatch(loadGroupPeople({ query: { kind: 'group', groupId: id, category: tab } }))}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(person) => person.id}
          contentContainerStyle={items.length === 0 ? visitListStyles.emptyContainer : visitListStyles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={people.refreshing}
              onRefresh={() => {
                dispatch(loadPresentStart({ refresh: true }));
                dispatch(loadGroupPeople({ refresh: true }));
              }}
            />
          }
          ListHeaderComponent={
            tab === 'CHILD' && items.length > 0 ? (
              <Text style={visitListStyles.total}>
                В саду {group.present.length} из {group.totalChildren}
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => (
            <PersonRow person={item} tab={tab} first={index === 0} last={index === items.length - 1} />
          )}
          onEndReached={() => {
            if (!people.last && !people.loadingMore && !people.loadMoreFailed) {
              dispatch(loadMoreGroupPeople());
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={footer}
          ListEmptyComponent={
            tab === 'CHILD' ? (
              <View>
                <Text style={visitListStyles.message}>В группе пока нет детей</Text>
                {openMembers ? (
                  <TouchableOpacity
                    style={gardenStyles.primaryButton}
                    onPress={() => openMembers(id)}
                    accessibilityRole="button"
                  >
                    <Text style={gardenStyles.primaryButtonText}>Добавить детей</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <Text style={visitListStyles.message}>
                {group.totalChildren === 0
                  ? 'Родители появятся, когда в группе будут дети'
                  : 'У детей группы пока нет привязанных родителей'}
              </Text>
            )
          }
        />
      )}

      <OptionSheet
        visible={sheet === 'menu'}
        title={branch ? `${group.name} · ${branch.name}` : group.name}
        onClose={() => setSheet(null)}
        sections={[{ key: 'actions', title: '', data: menu }]}
      />
      <OptionSheet
        visible={sheet === 'move'}
        title="Перенести в филиал"
        onClose={() => setSheet(null)}
        sections={[{ key: 'branches', title: '', data: moveOptions }]}
      />
    </View>
  );
}

function PersonRow({ person, tab, first, last }: { person: Person; tab: Tab; first: boolean; last: boolean }) {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const gardenStyles = useGardenStyles();
  const subtitle = tab === 'CHILD' ? ageLabel(person.birthDate) : parentSubtitle(person);
  return (
    <View style={[visitListStyles.row, first && visitListStyles.rowFirst, last && visitListStyles.rowLast]}>
      {tab === 'CHILD' ? (
        <View
          style={[visitListStyles.dot, person.present ? visitListStyles.dotIn : styles.dotAway]}
          accessibilityLabel={person.present ? 'В саду' : 'Не в саду'}
        />
      ) : null}
      <View style={gardenStyles.rowText}>
        <Text style={visitListStyles.rowTitle}>{personName(person)}</Text>
        {subtitle ? (
          <Text style={gardenStyles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {tab === 'PARENT' && person.phone ? (
        <TouchableOpacity
          style={styles.call}
          onPress={() => Linking.openURL(`tel:${person.phone}`)}
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

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    footer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    dotAway: {
      borderWidth: 1.5,
      borderColor: c.iconMuted,
    },
    call: {
      padding: 6,
    },
  })
);
