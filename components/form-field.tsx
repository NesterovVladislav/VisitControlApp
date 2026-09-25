import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

export interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  /** Дополнительный элемент под ошибкой, например ссылка «Войти». */
  errorAction?: React.ReactNode;
  ref?: React.Ref<TextInput>;
}

/**
 * Поле формы: подпись, поле ввода, подсказка или текст ошибки под ним.
 */
export default function FormField({
  label,
  error,
  hint,
  errorAction,
  editable = true,
  style,
  ref,
  ...inputProps
}: FormFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        style={[styles.input, error && styles.inputError, !editable && styles.inputDisabled, style]}
        placeholderTextColor="#999"
        editable={editable}
        accessibilityLabel={label}
        accessibilityHint={error}
        {...inputProps}
      />
      {error ? (
        <>
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
          {errorAction}
        </>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export const formFieldStyles = StyleSheet.create({
  error: {
    marginTop: 6,
    fontSize: 13,
    color: '#D32F2F',
  },
});

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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  inputError: {
    borderColor: '#D32F2F',
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  error: formFieldStyles.error,
  hint: {
    marginTop: 6,
    fontSize: 13,
    color: '#666',
  },
});
