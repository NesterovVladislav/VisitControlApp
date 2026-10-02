import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useGardenStyles } from '../../../components/garden-styles';
import OptionSheet from '../../../components/option-sheet';
import { IconSymbol } from '../../../components/ui/icon-symbol';
import { LoadState, useVisitListStyles } from '../../../components/visit-list';
import { useGardenEdit } from '../../../hooks/use-garden-edit';
import { useAppDispatch, useAppSelector } from '../../../store';
import { loadWithoutGroupCount } from '../../../store/reducers/garden';
import { loadPresentStart } from '../../../store/reducers/visits';
import { branchSubtitle, childrenLabel, gardenBranches, gardenErrorMessage, notEmptyMessage } from '../../../utils/garden';
import { BranchSummary, OTHER_GROUPS_ID } from '../../../utils/presence';
import { usePalette } from '../../../hooks/use-palette';

/**
 * «Сад»: филиалы с числом групп и детей, «Дети без группы». Данные — те же GET /group/presence и /branch/list,
 * что у «Посещения» (docs/garden-screen.md). Список филиалов показывается и при одном филиале.
 */
export default function GardenScreen() {
  const c = usePalette();
  const visitListStyles = useVisitListStyles();
  const gardenStyles = useGardenStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { data, status, refreshing } = useAppSelector((state) => state.visits.present);
  const withoutGroupCount = useAppSelector((state) => state.garden.withoutGroupCount);
  const [menuFor, setMenuFor] = useState<BranchSummary | null>(null);
  const branches = useMemo(() => gardenBranches(data), [data]);
  // Название для сообщения об ошибке: шторка к этому времени уже закрыта
  const deletingName = useRef('');

  useFocusEffect(
    useCallback(() => {
      dispatch(loadPresentStart());
      dispatch(loadWithoutGroupCount());
    }, [dispatch])
  );

  const { run } = useGardenEdit({
    onDone: () => {},
    onError: (error) => Alert.alert('Не удалось удалить филиал', gardenErrorMessage(error, 'branch', deletingName.current)),
  });

  const addBranch = () => router.push({ pathname: '/garden/name', params: { kind: 'branch' } });

  function confirmDelete(branch: BranchSummary) {
    if (branch.groupCount > 0) {
      Alert.alert('Нельзя удалить филиал', notEmptyMessage('branch', branch.name, branch.groupCount), [{ text: 'Понятно' }]);
      return;
    }
    Alert.alert(`Удалить филиал «${branch.name}»?`, undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          deletingName.current = branch.name;
          run({ type: 'deleteBranch', id: branch.id });
        },
      },
    ]);
  }

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <TouchableOpacity
            onPress={addBranch}
            accessibilityRole="button"
            accessibilityLabel="Новый филиал"
            hitSlop={8}
            style={gardenStyles.headerIcon}
          >
            <IconSymbol name="plus" size={24} color={c.primary} />
          </TouchableOpacity>
        ),
      }}
    />
  );

  if (status !== 'loaded') {
    return (
      <>
        {header}
        <LoadState status={status} onRetry={() => dispatch(loadPresentStart())} />
      </>
    );
  }

  const withoutGroup =
    withoutGroupCount && withoutGroupCount > 0 ? (
      <TouchableOpacity
        style={[visitListStyles.row, visitListStyles.rowFirst, visitListStyles.rowLast, { marginTop: 12 }]}
        onPress={() => router.push('/garden/without-group')}
        accessibilityRole="button"
        accessibilityLabel={`Дети без группы: ${childrenLabel(withoutGroupCount)}`}
      >
        <Text style={[visitListStyles.rowTitle, gardenStyles.rowText]}>Дети без группы</Text>
        <Text style={gardenStyles.count}>{withoutGroupCount}</Text>
        <IconSymbol name="chevron.right" size={20} color={c.iconMuted} />
      </TouchableOpacity>
    ) : null;

  return (
    <View style={gardenStyles.screen}>
      {header}
      <FlatList
        data={branches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={branches.length === 0 ? visitListStyles.emptyContainer : visitListStyles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              dispatch(loadPresentStart({ refresh: true }));
              dispatch(loadWithoutGroupCount());
            }}
          />
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[
              visitListStyles.row,
              index === 0 && visitListStyles.rowFirst,
              index === branches.length - 1 && visitListStyles.rowLast,
            ]}
            onPress={() => router.push({ pathname: '/garden/branch/[id]', params: { id: item.id } })}
            onLongPress={item.id === OTHER_GROUPS_ID ? undefined : () => setMenuFor(item)}
            accessibilityRole="button"
            accessibilityHint={item.id === OTHER_GROUPS_ID ? undefined : 'Долгое нажатие — переименовать или удалить'}
          >
            <View style={gardenStyles.rowText}>
              <Text style={visitListStyles.rowTitle}>{item.name}</Text>
              <Text style={gardenStyles.rowSubtitle}>{branchSubtitle(item)}</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={c.iconMuted} />
          </TouchableOpacity>
        )}
        ListFooterComponent={withoutGroup}
        ListEmptyComponent={
          <View>
            <Text style={visitListStyles.message}>Филиалов пока нет</Text>
            <TouchableOpacity style={gardenStyles.primaryButton} onPress={addBranch} accessibilityRole="button">
              <Text style={gardenStyles.primaryButtonText}>Добавить филиал</Text>
            </TouchableOpacity>
            {withoutGroup}
          </View>
        }
      />
      <OptionSheet
        visible={menuFor !== null}
        title={menuFor?.name ?? ''}
        onClose={() => setMenuFor(null)}
        sections={
          menuFor
            ? [
                {
                  key: 'actions',
                  title: '',
                  data: [
                    {
                      key: 'rename',
                      label: 'Переименовать',
                      onPress: () =>
                        router.push({ pathname: '/garden/name', params: { kind: 'branch', id: menuFor.id } }),
                    },
                    { key: 'delete', label: 'Удалить', destructive: true, onPress: () => confirmDelete(menuFor) },
                  ],
                },
              ]
            : []
        }
      />
    </View>
  );
}
