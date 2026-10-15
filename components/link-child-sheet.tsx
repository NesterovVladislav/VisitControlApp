import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Avatar from './avatar';
import { IconSymbol } from './ui/icon-symbol';
import { useVisitListStyles } from './visit-list';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { useAppDispatch, useAppSelector } from '../store';
import {
  clearChildLinkResult,
  closeChildLink,
  linkChild,
  searchLinkCandidates,
} from '../store/reducers/child-link';
import { LinkRole, Person } from '../store/types/people';
import { childSubtitle, linkLabel, personName } from '../utils/people-format';

/** Задержка поиска после ввода: не отправляем запрос на каждую букву. */
const SEARCH_DELAY_MS = 300;

const LINK_ROLES: LinkRole[] = ['PARENT', 'RELATIVE', 'ACQUAINTANCE'];

/**
 * Шторка «Привязать ребёнка»: администратор находит ребёнка сада, выбирает, кем ему приходится взрослый,
 * и подтверждает. Открывается из строки взрослого во вкладке «Люди» (openChildLink).
 */
export default function LinkChildSheet({ showBranch }: { showBranch: boolean }) {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const dispatch = useAppDispatch();
  const { adult, candidates, status, link } = useAppSelector((state) => state.childLink);
  const [text, setText] = useState('');
  const [child, setChild] = useState<Person | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adultId = adult?.id;

  // Новая шторка — пустой поиск и снова выбор ребёнка
  useEffect(() => {
    setText('');
    setChild(null);
    cancelSearch();
  }, [adultId]);

  useEffect(() => () => cancelSearch(), []);

  // Результат привязки — диалогом, один раз
  useEffect(() => {
    if (!link || link.status === 'pending') {
      return;
    }
    if (link.status === 'linked') {
      Alert.alert('Ребёнок привязан', 'Он появится у взрослого в «Моих детях».');
      dispatch(closeChildLink());
    } else if (link.message) {
      Alert.alert('Ребёнок не привязан', link.message);
    }
    dispatch(clearChildLinkResult());
  }, [link, dispatch]);

  function cancelSearch() {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }

  function changeText(value: string) {
    setText(value);
    cancelSearch();
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      dispatch(searchLinkCandidates(value));
    }, SEARCH_DELAY_MS);
  }

  function close() {
    cancelSearch();
    dispatch(closeChildLink());
  }

  function confirm(target: Person, adultPerson: Person, linkRole: LinkRole) {
    const label = linkLabel(linkRole, adultPerson.gender);
    Alert.alert(
      'Привязать ребёнка?',
      `Ребёнок: ${personName(target)}\n${personName(adultPerson)} — ${label}.\n\n` +
        'Взрослый увидит ребёнка в «Моих детях» и сможет приводить и забирать его.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Привязать', onPress: () => dispatch(linkChild({ child: target, linkRole })) },
      ],
      { cancelable: true }
    );
  }

  if (!adult) {
    return null;
  }

  const linked = new Set((adult.children ?? []).map((item) => item.id));
  const pending = link?.status === 'pending';

  return (
    <Modal visible animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Закрыть" />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          {child ? (
            <TouchableOpacity onPress={() => setChild(null)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>Назад</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={close} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Отмена</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Привязать ребёнка</Text>
        <Text style={styles.subtitle}>к {personName(adult)}</Text>

        {child ? (
          <View>
            <Text style={visitListStyles.sectionTitle}>
              {`КЕМ ПРИХОДИТСЯ: ${personName(child).toUpperCase()}`}
            </Text>
            {LINK_ROLES.map((linkRole) => (
              <TouchableOpacity
                key={linkRole}
                style={styles.option}
                disabled={pending}
                onPress={() => confirm(child, adult, linkRole)}
                accessibilityRole="button"
              >
                <Text style={styles.optionText}>{capitalize(linkLabel(linkRole, adult.gender))}</Text>
                {pending ? <ActivityIndicator color={c.textTertiary} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.search}>
              <IconSymbol name="magnifyingglass" size={20} color={c.textTertiary} />
              <TextInput
                style={styles.searchInput}
                value={text}
                onChangeText={changeText}
                placeholder="Фамилия, имя ребёнка"
                placeholderTextColor={c.placeholder}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Поиск ребёнка"
              />
            </View>
            {status === 'loading' ? (
              <ActivityIndicator style={styles.footer} color={c.textTertiary} />
            ) : status === 'failed' ? (
              <TouchableOpacity style={styles.footer} onPress={() => dispatch(searchLinkCandidates(text))}>
                <Text style={styles.link}>Не удалось загрузить детей. Повторить</Text>
              </TouchableOpacity>
            ) : (
              <FlatList
                data={candidates}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.empty}>{text ? `Никого не нашли по запросу «${text}»` : 'Детей пока нет'}</Text>
                }
                renderItem={({ item }) => {
                  const already = linked.has(item.id);
                  const subtitle = already ? 'Уже привязан' : childSubtitle(item, showBranch);
                  return (
                    <TouchableOpacity
                      style={[styles.option, already && styles.disabled]}
                      disabled={already}
                      onPress={() => setChild(item)}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: already }}
                      accessibilityLabel={`Выбрать: ${personName(item)}`}
                    >
                      <View style={styles.photo}>
                        <Avatar firstName={item.firstName} surname={item.surname} photoUrl={item.photoUrl} size={32} />
                      </View>
                      <View style={styles.rowText}>
                        <Text style={styles.optionText}>{personName(item)}</Text>
                        {subtitle ? (
                          <Text style={styles.rowSubtitle} numberOfLines={1}>
                            {subtitle}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: c.overlay,
    },
    sheet: {
      height: '80%',
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
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      marginTop: 2,
      marginBottom: 12,
    },
    link: {
      color: c.primary,
      fontSize: 15,
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
    option: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: c.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    optionText: {
      fontSize: 16,
      color: c.text,
    },
    disabled: {
      opacity: 0.5,
    },
    photo: {
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
    empty: {
      textAlign: 'center',
      color: c.textSecondary,
      fontSize: 15,
      paddingVertical: 24,
    },
    footer: {
      paddingVertical: 16,
      alignItems: 'center',
    },
  })
);
