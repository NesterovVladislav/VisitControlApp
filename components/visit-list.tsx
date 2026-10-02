import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LoadStatus } from '@/store/types/visits';
import { PresentSection } from '@/utils/presence';
import { makeStyles, usePalette } from '../hooks/use-palette';

/**
 * Дети в саду по группам: заголовок группы «Ромашка · 2 из 18» и строки детей.
 * Общий для вкладки «Посещение» (один филиал) и экрана филиала.
 */
export function PresenceSections({
  sections,
  header,
  emptyText,
  refreshing,
  onRefresh,
  onEditGroup,
}: {
  sections: PresentSection[];
  /** Итог над списком, например «В саду 12 из 40» */
  header: string | null;
  emptyText: string;
  refreshing: boolean;
  onRefresh: () => void;
  /** «Изменить» у заголовка группы (состав группы) — только администратору */
  onEditGroup?: (groupId: string) => void;
}) {
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const empty = sections.length === 0;
  return (
    <SectionList
      sections={sections}
      keyExtractor={(child, index) => `${child.id}-${index}`}
      contentContainerStyle={empty ? visitListStyles.emptyContainer : visitListStyles.listContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={empty || !header ? null : <Text style={visitListStyles.total}>{header}</Text>}
      renderSectionHeader={({ section }) =>
        section.title ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[visitListStyles.sectionTitle, styles.sectionTitle]}>{section.title.toUpperCase()}</Text>
              {onEditGroup && section.group ? (
                <TouchableOpacity
                  onPress={() => onEditGroup(section.group!.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Изменить состав группы ${section.group.name}`}
                  hitSlop={8}
                >
                  <Text style={styles.editText}>Изменить</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {section.emptyText ? <Text style={styles.sectionEmpty}>{section.emptyText}</Text> : null}
          </View>
        ) : null
      }
      renderItem={({ item, index, section }) => (
        <View
          style={[
            visitListStyles.row,
            index === 0 && visitListStyles.rowFirst,
            index === section.data.length - 1 && visitListStyles.rowLast,
          ]}
        >
          <View style={[visitListStyles.dot, visitListStyles.dotIn]} />
          <Text style={visitListStyles.rowTitle}>{`${item.firstName} ${item.surname}`.trim()}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={visitListStyles.message}>{emptyText}</Text>}
    />
  );
}

/**
 * Спиннер при первой загрузке или «Не удалось загрузить данные» с повтором.
 */
export function LoadState({ status, onRetry }: { status: LoadStatus; onRetry: () => void }) {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  if (status === 'failed') {
    return (
      <View style={visitListStyles.center}>
        <Text style={visitListStyles.message}>Не удалось загрузить данные</Text>
        <TouchableOpacity style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={visitListStyles.center}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}

/**
 * Стили списков вкладки «Посещение»: карточки из строк, заголовки секций, пустые состояния.
 */
export const useVisitListStyles = makeStyles((c) =>
  StyleSheet.create({
    listContainer: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    emptyContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 20,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    total: {
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: c.textTertiary,
      marginTop: 8,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
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
      marginBottom: 12,
    },
    rowTitle: {
      fontSize: 16,
      color: c.text,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 12,
    },
    dotIn: {
      backgroundColor: c.success,
    },
    dotOut: {
      backgroundColor: c.textTertiary,
    },
    message: {
      fontSize: 16,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 8,
    },
  })
);

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionTitle: {
      flex: 1,
    },
    editText: {
      fontSize: 14,
      color: c.primary,
      marginTop: 8,
      marginBottom: 8,
      marginLeft: 12,
    },
    sectionEmpty: {
      fontSize: 14,
      color: c.textTertiary,
      marginBottom: 12,
    },
    retry: {
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    retryText: {
      color: c.primary,
      fontSize: 16,
      fontWeight: '600',
    },
  })
);
