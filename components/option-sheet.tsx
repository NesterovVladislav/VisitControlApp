import React, { useRef } from 'react';
import { Modal, Platform, Pressable, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/icon-symbol';
import { useVisitListStyles } from './visit-list';
import { makeStyles, usePalette } from '../hooks/use-palette';

export interface SheetOption {
  key: string;
  label: string;
  onPress: () => void;
  /** Красным: удаление */
  destructive?: boolean;
  /** Галочка: текущий вариант */
  selected?: boolean;
}

export interface SheetSection {
  key: string;
  /** Заголовок секции, например филиал; пустой — без заголовка */
  title: string;
  data: SheetOption[];
}

/**
 * Шторка снизу: меню «⋯» или выбор группы и филиала. Вместо Alert: на Android в нём не больше трёх кнопок.
 * Нажатие на вариант закрывает шторку и затем выполняет действие. На iOS — после того как шторка скрылась:
 * Alert, показанный во время закрытия Modal, не появляется.
 */
export default function OptionSheet({
  visible,
  title,
  sections,
  onClose,
}: {
  visible: boolean;
  title: string;
  sections: SheetSection[];
  onClose: () => void;
}) {
  const c = usePalette();
  const styles = useStyles();
  const visitListStyles = useVisitListStyles();
  const pending = useRef<(() => void) | null>(null);

  function choose(option: SheetOption) {
    onClose();
    if (Platform.OS === 'ios') {
      pending.current = option.onPress;
    } else {
      option.onPress();
    }
  }

  function runPending() {
    const action = pending.current;
    pending.current = null;
    action?.();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} onDismiss={runPending}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.close}>Отмена</Text>
          </TouchableOpacity>
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            section.title ? <Text style={visitListStyles.sectionTitle}>{section.title.toUpperCase()}</Text> : null
          }
          renderItem={({ item, index, section }) => (
            <TouchableOpacity
              style={[
                styles.option,
                index === 0 && styles.optionFirst,
                index === section.data.length - 1 && styles.optionLast,
              ]}
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: Boolean(item.selected) }}
            >
              <Text style={[styles.optionText, item.destructive && styles.destructive]}>{item.label}</Text>
              {item.selected ? <IconSymbol name="checkmark" size={20} color={c.primary} /> : null}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
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
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
    },
    title: {
      flex: 1,
      marginRight: 12,
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
    },
    close: {
      color: c.primary,
      fontSize: 16,
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
    optionFirst: {
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
    },
    optionLast: {
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      borderBottomWidth: 0,
      marginBottom: 12,
    },
    optionText: {
      fontSize: 16,
      color: c.text,
    },
    destructive: {
      color: c.danger,
    },
  })
);
