import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import OptionSheet, { SheetSection } from './option-sheet';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { useAppDispatch, useAppSelector } from '../store';
import { clearChildRequestError, decideChildRequestStart } from '../store/reducers/child-requests';
import { ChildRequest, ChildRequestDecision } from '../store/types/child-requests';
import { applicantLabel, childRequestName, childRequestSummary, matchOptionLabel } from '../utils/child-requests';

/**
 * Заявки пользователей сада «добавить мне ребёнка» у администратора: над заявками на регистрацию.
 * Решение — как по ребёнку из заявки на регистрацию: привязать ребёнка, который уже есть в саду, завести нового
 * или не добавлять.
 */
export default function ChildRequestsList() {
  const c = usePalette();
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const { pending, decidingIds, error } = useAppSelector((state) => state.childRequests);
  const [deciding, setDeciding] = useState<ChildRequest | null>(null);

  useEffect(() => {
    if (error) {
      Alert.alert('Не получилось', error, [{ text: 'OK', onPress: () => dispatch(clearChildRequestError()) }]);
    }
  }, [error, dispatch]);

  if (pending.length === 0) {
    return null;
  }

  function decide(request: ChildRequest, decision: ChildRequestDecision) {
    dispatch(decideChildRequestStart({ id: request.id, decision }));
  }

  function confirmSkip(request: ChildRequest) {
    Alert.alert(childRequestName(request), 'Не добавлять ребёнка? Заявитель увидит, что сад отклонил заявку.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Не добавлять', style: 'destructive', onPress: () => decide(request, { kind: 'SKIP' }) },
    ]);
  }

  const sections: SheetSection[] = deciding
    ? [
        {
          key: 'decision',
          title: '',
          data: [
            ...deciding.matches.map((match) => ({
              key: match.id,
              label: matchOptionLabel(match),
              onPress: () => decide(deciding, { kind: 'LINK', childId: match.id }),
            })),
            {
              key: 'create',
              label: 'Новый ребёнок — добавить в сад',
              onPress: () => decide(deciding, { kind: 'CREATE' }),
            },
            {
              key: 'skip',
              label: 'Не добавлять',
              destructive: true,
              onPress: () => confirmSkip(deciding),
            },
          ],
        },
      ]
    : [];

  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>ДОБАВЛЕНИЕ ДЕТЕЙ</Text>
      {pending.map((request, index) => {
        const busy = decidingIds.includes(request.id);
        return (
          <TouchableOpacity
            key={request.id}
            style={[styles.row, index === 0 && styles.rowFirst, index === pending.length - 1 && styles.rowLast]}
            onPress={() => setDeciding(request)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Заявка на ребёнка: ${childRequestName(request)}`}
          >
            <View style={styles.rowText}>
              <Text style={styles.name}>{childRequestSummary(request)}</Text>
              <Text style={styles.applicant}>Просит добавить: {applicantLabel(request)}</Text>
              {request.matches.length > 0 ? (
                <Text style={styles.match}>Похожий ребёнок уже есть в саду</Text>
              ) : null}
            </View>
            {busy ? <ActivityIndicator color={c.textTertiary} /> : <Text style={styles.decide}>Решить</Text>}
          </TouchableOpacity>
        );
      })}
      <OptionSheet
        visible={deciding !== null}
        title={deciding ? childRequestName(deciding) : ''}
        sections={sections}
        onClose={() => setDeciding(null)}
      />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    block: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: c.textTertiary,
      marginBottom: 8,
      marginLeft: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    rowFirst: {
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
    },
    rowLast: {
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      borderBottomWidth: 0,
    },
    rowText: {
      flex: 1,
      marginRight: 12,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },
    applicant: {
      marginTop: 2,
      fontSize: 14,
      color: c.textSecondary,
    },
    match: {
      marginTop: 2,
      fontSize: 13,
      color: c.warning,
    },
    decide: {
      fontSize: 15,
      fontWeight: '500',
      color: c.primary,
    },
  })
);
