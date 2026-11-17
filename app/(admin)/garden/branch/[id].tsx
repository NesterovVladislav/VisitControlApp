import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { RefreshControl } from '../../../../components/ui/refresh-control';
import { useGardenStyles } from '../../../../components/garden-styles';
import OptionSheet from '../../../../components/option-sheet';
import { IconSymbol } from '../../../../components/ui/icon-symbol';
import { LoadState, useVisitListStyles } from '../../../../components/visit-list';
import { useGardenEdit } from '../../../../hooks/use-garden-edit';
import { useAppDispatch, useAppSelector } from '../../../../store';
import { loadPresentStart } from '../../../../store/reducers/visits';
import { gardenErrorMessage, groupSubtitle, notEmptyMessage } from '../../../../utils/garden';
import { OTHER_GROUPS_ID, branchName, groupsOf } from '../../../../utils/presence';
import { usePalette } from '../../../../hooks/use-palette';

/**
 * Филиал в «Саде»: группы с числом детей, в том числе пустые, «＋ Добавить группу», меню филиала.
 * Данные те же, что у списка филиалов, экран открывается без загрузки.
 */
export default function GardenBranchScreen() {
  const c = usePalette();
  const visitListStyles = useVisitListStyles();
  const gardenStyles = useGardenStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { data, status, refreshing } = useAppSelector((state) => state.visits.present);
  const [menuOpen, setMenuOpen] = useState(false);

  const name = useMemo(() => branchName(data, id), [data, id]);
  const groups = useMemo(() => groupsOf(data, id), [data, id]);
  // «Другие группы» — не филиал: ни меню, ни новой группы
  const isBranch = id !== OTHER_GROUPS_ID;

  useFocusEffect(
    useCallback(() => {
      dispatch(loadPresentStart());
    }, [dispatch])
  );

  const { run } = useGardenEdit({
    onDone: () => router.back(),
    onError: (error) => Alert.alert('Не удалось удалить филиал', gardenErrorMessage(error, 'branch', name ?? '')),
  });

  function confirmDelete() {
    if (!name) {
      return;
    }
    if (groups.length > 0) {
      Alert.alert('Нельзя удалить филиал', notEmptyMessage('branch', name, groups.length), [{ text: 'Понятно' }]);
      return;
    }
    Alert.alert(`Удалить филиал «${name}»?`, undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => run({ type: 'deleteBranch', id }) },
    ]);
  }

  if (status !== 'loaded') {
    return <LoadState status={status} onRetry={() => dispatch(loadPresentStart())} />;
  }

  // Филиал удалили на другом устройстве, пока экран был открыт
  if (!name) {
    return (
      <View style={visitListStyles.center}>
        <Stack.Screen options={{ title: 'Филиал' }} />
        <Text style={visitListStyles.message}>Филиал не найден</Text>
        <TouchableOpacity style={gardenStyles.action} onPress={() => router.back()} accessibilityRole="button">
          <Text style={gardenStyles.actionText}>К списку филиалов</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const addGroup = () => router.push({ pathname: '/garden/name', params: { kind: 'group', branchId: id } });

  return (
    <View style={gardenStyles.screen}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: isBranch
            ? () => (
                <TouchableOpacity
                  onPress={() => setMenuOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Меню филиала"
                  hitSlop={8}
                  style={gardenStyles.headerIcon}
                >
                  <IconSymbol name="ellipsis" size={24} color={c.primary} />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />
      <FlatList
        data={groups}
        keyExtractor={(group) => group.id}
        contentContainerStyle={groups.length === 0 ? visitListStyles.emptyContainer : visitListStyles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => dispatch(loadPresentStart({ refresh: true }))} />
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[
              visitListStyles.row,
              index === 0 && visitListStyles.rowFirst,
              index === groups.length - 1 && visitListStyles.rowLast,
            ]}
            onPress={() => router.push({ pathname: '/garden/group/[id]', params: { id: item.id } })}
            accessibilityRole="button"
          >
            <View style={gardenStyles.rowText}>
              <Text style={visitListStyles.rowTitle}>{item.name}</Text>
              <Text style={gardenStyles.rowSubtitle}>{groupSubtitle(item)}</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={c.iconMuted} />
          </TouchableOpacity>
        )}
        ListFooterComponent={
          isBranch && groups.length > 0 ? (
            <TouchableOpacity style={gardenStyles.action} onPress={addGroup} accessibilityRole="button">
              <Text style={gardenStyles.actionText}>＋ Добавить группу</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View>
            <Text style={visitListStyles.message}>В филиале пока нет групп</Text>
            {isBranch ? (
              <TouchableOpacity style={gardenStyles.primaryButton} onPress={addGroup} accessibilityRole="button">
                <Text style={gardenStyles.primaryButtonText}>Добавить группу</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />
      <OptionSheet
        visible={menuOpen}
        title={name}
        onClose={() => setMenuOpen(false)}
        sections={[
          {
            key: 'actions',
            title: '',
            data: [
              {
                key: 'rename',
                label: 'Переименовать филиал',
                onPress: () => router.push({ pathname: '/garden/name', params: { kind: 'branch', id } }),
              },
              { key: 'delete', label: 'Удалить филиал', destructive: true, onPress: confirmDelete },
            ],
          },
        ]}
      />
    </View>
  );
}
