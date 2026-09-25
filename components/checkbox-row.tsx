import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formFieldStyles } from './form-field';

interface CheckboxRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Подпись; может содержать ссылки (вложенные Text с onPress). */
  children: React.ReactNode;
  /** Текст для скринридера, если в подписи есть ссылки. */
  accessibilityLabel?: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Чекбокс с подписью. Нажатие на квадрат переключает значение;
 * подпись нажимается отдельно, чтобы ссылки внутри неё работали.
 */
export default function CheckboxRow({
  checked,
  onChange,
  children,
  accessibilityLabel,
  error,
  disabled = false,
}: CheckboxRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.box, checked && styles.boxChecked, error && styles.boxError]}
          onPress={() => onChange(!checked)}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked, disabled }}
          accessibilityLabel={accessibilityLabel}
        >
          {checked ? <Text style={styles.checkmark}>✓</Text> : null}
        </TouchableOpacity>
        <Text style={styles.label} onPress={disabled ? undefined : () => onChange(!checked)}>
          {children}
        </Text>
      </View>
      {error ? <Text style={formFieldStyles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#999',
    borderRadius: 4,
    marginRight: 10,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  boxChecked: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  boxError: {
    borderColor: '#D32F2F',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});
