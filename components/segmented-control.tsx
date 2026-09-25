import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formFieldStyles } from './form-field';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Подпись над переключателем, как у полей формы; без неё — только кнопки */
  label?: string;
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Выбор одного варианта из нескольких кнопок в ряд.
 */
export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.group, error && styles.groupError]} accessibilityRole="radiogroup">
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.segment,
                index > 0 && styles.segmentDivider,
                selected && styles.segmentSelected,
              ]}
              onPress={() => onChange(option.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={formFieldStyles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  groupError: {
    borderColor: '#D32F2F',
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  segmentDivider: {
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
  },
  segmentSelected: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 16,
    color: '#333',
  },
  segmentTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
