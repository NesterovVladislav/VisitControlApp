import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { makeStyles, usePalette } from '../hooks/use-palette';

interface CommentSheetProps {
  visible: boolean;
  title: string;
  /** Вопрос под заголовком, например «Отметить приход в сад?» */
  message?: string;
  /** Подпись над полем ввода */
  label: string;
  placeholder?: string;
  maxLength: number;
  /** Готовые варианты текста: нажатие подставляет вариант в поле */
  presets?: string[];
  /** Без текста подтвердить нельзя (причина отклонения) */
  required?: boolean;
  confirmLabel: string;
  /** Красная кнопка: отклонение */
  destructive?: boolean;
  onConfirm: (comment: string) => void;
  onClose: () => void;
}

/**
 * Шторка снизу с полем для текста: подтверждение отметки с комментарием или отклонение с причиной.
 * Вместо Alert: в системный диалог поле ввода на Android не добавить.
 */
export default function CommentSheet({
  visible,
  title,
  message,
  label,
  placeholder,
  maxLength,
  presets,
  required = false,
  confirmLabel,
  destructive = false,
  onConfirm,
  onClose,
}: CommentSheetProps) {
  const c = usePalette();
  const styles = useStyles();
  const [text, setText] = useState('');

  // Каждое открытие — с пустым полем
  useEffect(() => {
    if (visible) {
      setText('');
    }
  }, [visible]);

  const trimmed = text.trim();
  const disabled = required && trimmed.length === 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* На Android с edgeToEdgeEnabled система не сжимает окно под клавиатуру, поэтому padding нужен и там. */}
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {presets && presets.length > 0 ? (
            <View style={styles.presets}>
              {presets.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.preset, trimmed === preset && styles.presetSelected]}
                  onPress={() => setText(preset)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: trimmed === preset }}
                >
                  <Text style={[styles.presetText, trimmed === preset && styles.presetTextSelected]}>{preset}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={c.placeholder}
            maxLength={maxLength}
            multiline
            accessibilityLabel={label}
          />
          <Text style={styles.counter}>
            {text.length} / {maxLength}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onClose} accessibilityRole="button">
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, destructive ? styles.confirmDanger : styles.confirm, disabled && styles.disabled]}
              onPress={() => onConfirm(trimmed)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    backdrop: {
      flex: 1,
      backgroundColor: c.overlay,
    },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 32,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: c.text,
    },
    message: {
      marginTop: 6,
      fontSize: 15,
      color: c.textSecondary,
    },
    presets: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 14,
      marginBottom: -6,
    },
    preset: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 7,
      paddingHorizontal: 12,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: c.card,
    },
    presetSelected: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    presetText: {
      fontSize: 14,
      color: c.text,
    },
    presetTextSelected: {
      color: c.primary,
      fontWeight: '500',
    },
    label: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 14,
      lineHeight: 19,
      color: c.textSecondary,
    },
    input: {
      minHeight: 72,
      maxHeight: 140,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.card,
      textAlignVertical: 'top',
    },
    counter: {
      marginTop: 4,
      fontSize: 12,
      color: c.textTertiary,
      textAlign: 'right',
    },
    actions: {
      flexDirection: 'row',
      marginTop: 16,
    },
    button: {
      flex: 1,
      minHeight: 48,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    cancel: {
      marginRight: 12,
      backgroundColor: c.fill,
    },
    cancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },
    confirm: {
      backgroundColor: c.primary,
    },
    confirmDanger: {
      backgroundColor: c.danger,
    },
    disabled: {
      backgroundColor: c.disabled,
    },
    confirmText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.onPrimary,
    },
  })
);
