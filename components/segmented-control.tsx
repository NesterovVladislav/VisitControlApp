import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFormFieldStyles } from './form-field';
import { makeStyles } from '../hooks/use-palette';

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
  const styles = useStyles();
  const formFieldStyles = useFormFieldStyles();
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
              aria-checked={selected}
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

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      color: c.text,
    },
    group: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    groupError: {
      borderColor: c.danger,
    },
    segment: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: c.card,
    },
    segmentDivider: {
      borderLeftWidth: 1,
      borderLeftColor: c.border,
    },
    segmentSelected: {
      backgroundColor: c.primary,
    },
    segmentText: {
      fontSize: 16,
      color: c.text,
    },
    segmentTextSelected: {
      color: c.onPrimary,
      fontWeight: '600',
    },
  })
);
