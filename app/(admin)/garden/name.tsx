import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useGardenStyles } from '../../../components/garden-styles';
import { useVisitListStyles } from '../../../components/visit-list';
import { useGardenEdit } from '../../../hooks/use-garden-edit';
import { useAppSelector } from '../../../store';
import { NAME_MAX_LENGTH, findPresenceGroup, gardenErrorMessage, isNameTaken, takenNames } from '../../../utils/garden';
import { makeStyles, usePalette } from '../../../hooks/use-palette';

type Params = {
  kind: 'branch' | 'group';
  /** Есть — переименовать, нет — создать */
  id?: string;
  /** Новая группа: в каком филиале */
  branchId?: string;
};

/**
 * Диалог названия филиала или группы: создать и переименовать (docs/garden-screen.md, «Диалог названия»).
 * Свой экран, а не Alert.prompt: тот есть только на iOS.
 */
export default function GardenNameScreen() {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const gardenStyles = useGardenStyles();
  const { kind, id, branchId: branchParam } = useLocalSearchParams<Params>();
  const router = useRouter();
  const presence = useAppSelector((state) => state.visits.present.data);

  const group = kind === 'group' && id ? findPresenceGroup(presence, id) : null;
  const branchId = kind === 'group' ? (group?.branchId ?? branchParam ?? null) : null;
  const initial = useMemo(() => {
    if (!id) {
      return '';
    }
    return kind === 'branch' ? (presence.branches.find((item) => item.id === id)?.name ?? '') : (group?.name ?? '');
    // Начальное название — один раз: после сохранения данные обновятся, поле менять не нужно
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [name, setName] = useState(initial);
  const [serverError, setServerError] = useState<string | null>(null);

  const taken = useMemo(() => takenNames(presence, kind, branchId, id ?? null), [presence, kind, branchId, id]);
  const trimmed = name.trim();
  const localError = trimmed && isNameTaken(trimmed, taken) ? 'Такое название уже есть' : null;
  const error = localError ?? serverError;
  const unchanged = Boolean(id) && trimmed === initial.trim();

  const { run, saving } = useGardenEdit({
    onDone: () => router.back(),
    onError: (editError) => setServerError(gardenErrorMessage(editError, kind, trimmed)),
  });

  const canSave = Boolean(trimmed) && !localError && !unchanged && !saving && (kind === 'branch' || Boolean(branchId));

  function save() {
    if (!canSave) {
      return;
    }
    setServerError(null);
    if (kind === 'branch') {
      run({ type: 'saveBranch', id: id ?? null, name: trimmed });
    } else if (branchId) {
      run({ type: 'saveGroup', id: id ?? null, name: trimmed, branchId });
    }
  }

  let title = 'Переименовать';
  if (!id) {
    title = kind === 'branch' ? 'Новый филиал' : 'Новая группа';
  }
  const branchName = kind === 'group' ? presence.branches.find((item) => item.id === branchId)?.name : null;

  return (
    <View style={gardenStyles.screen}>
      <Stack.Screen
        options={{
          title,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
              <Text style={gardenStyles.headerButton}>Отмена</Text>
            </TouchableOpacity>
          ),
          headerRight: () =>
            saving ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <TouchableOpacity
                onPress={save}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave }}
                hitSlop={8}
              >
                <Text style={[gardenStyles.headerButton, styles.bold, !canSave && styles.disabled]}>Сохранить</Text>
              </TouchableOpacity>
            ),
        }}
      />
      <View style={styles.content}>
        {branchName ? <Text style={styles.hint}>Филиал «{branchName}»</Text> : null}
        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setServerError(null);
          }}
          placeholder="Название"
          placeholderTextColor={c.placeholder}
          autoFocus
          maxLength={NAME_MAX_LENGTH}
          returnKeyType="done"
          onSubmitEditing={save}
          editable={!saving}
          accessibilityLabel="Название"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {kind === 'group' && !branchId ? (
          <Text style={visitListStyles.message}>Филиал группы не найден. Перенесите группу в филиал</Text>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    content: {
      padding: 20,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    hint: {
      fontSize: 15,
      color: c.textSecondary,
      marginBottom: 12,
    },
    input: {
      backgroundColor: c.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 17,
      color: c.text,
    },
    inputError: {
      borderColor: c.danger,
    },
    error: {
      marginTop: 8,
      fontSize: 14,
      color: c.danger,
    },
    bold: {
      fontWeight: '600',
    },
    disabled: {
      color: c.iconMuted,
    },
  })
);
