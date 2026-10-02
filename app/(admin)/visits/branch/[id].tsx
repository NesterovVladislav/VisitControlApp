import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LoadState, PresenceSections, useVisitListStyles } from '../../../../components/visit-list';
import { useOpenGroupMembers } from '../../../../hooks/use-open-group-members';
import { useAppDispatch, useAppSelector } from '../../../../store';
import { loadPresentStart } from '../../../../store/reducers/visits';
import { plural } from '../../../../utils/plural';
import { WITHOUT_GROUP_ID, branchName, branchSections, branchSummaries } from '../../../../utils/presence';
import { makeStyles } from '../../../../hooks/use-palette';

/**
 * Филиал: кто сейчас в саду, по группам, включая пустые. Данные те же, что у списка филиалов (GET /group/presence),
 * поэтому экран открывается без загрузки и обновляется вместе со списком. Администратор меняет состав группы.
 */
export default function BranchPresenceScreen() {
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { data, status, refreshing } = useAppSelector((state) => state.visits.present);

  useFocusEffect(
    useCallback(() => {
      dispatch(loadPresentStart());
    }, [dispatch])
  );

  const name = useMemo(() => branchName(data, id), [data, id]);
  const summary = useMemo(() => branchSummaries(data).find((item) => item.id === id), [data, id]);
  const sections = useMemo(() => branchSections(data, id), [data, id]);
  const openGroup = useOpenGroupMembers();

  if (status !== 'loaded') {
    return <LoadState status={status} onRetry={() => dispatch(loadPresentStart())} />;
  }

  // Филиал удалили или все дети без группы ушли, пока экран был открыт
  if (!summary) {
    return (
      <View style={visitListStyles.center}>
        <Stack.Screen options={{ title: id === WITHOUT_GROUP_ID ? 'Без группы' : 'Филиал' }} />
        <Text style={visitListStyles.message}>
          {id === WITHOUT_GROUP_ID ? 'Сейчас в саду нет детей без группы' : 'Филиал не найден'}
        </Text>
      </View>
    );
  }

  const header =
    summary.total === null
      ? `В саду ${summary.present} ${plural(summary.present, ['ребёнок', 'ребёнка', 'детей'])} без группы`
      : `В саду ${summary.present} из ${summary.total}`;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: name ?? 'Филиал' }} />
      <PresenceSections
        sections={sections}
        header={header}
        emptyText="В филиале пока нет групп"
        refreshing={refreshing}
        onRefresh={() => dispatch(loadPresentStart({ refresh: true }))}
        onEditGroup={openGroup}
      />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
  })
);
