import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { makeStyles, usePalette } from '../hooks/use-palette';

export interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  /** Дополнительный элемент под ошибкой, например ссылка «Войти». */
  errorAction?: React.ReactNode;
  /** Элемент справа внутри поля, например кнопка «показать пароль». */
  accessory?: React.ReactNode;
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
  accessory,
  editable = true,
  style,
  ref,
  ...inputProps
}: FormFieldProps) {
  const c = usePalette();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            error && styles.inputError,
            !editable && styles.inputDisabled,
            accessory ? styles.inputWithAccessory : null,
            style,
          ]}
          placeholderTextColor={c.placeholder}
          editable={editable}
          accessibilityLabel={label}
          accessibilityHint={error}
          {...inputProps}
        />
        {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      </View>
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

export const useFormFieldStyles = makeStyles((c) =>
  StyleSheet.create({
    error: {
      marginTop: 6,
      fontSize: 13,
      color: c.danger,
    },
  })
);

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
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: c.card,
      color: c.text,
    },
    inputWithAccessory: {
      paddingRight: 48,
    },
    accessory: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    inputError: {
      borderColor: c.danger,
    },
    inputDisabled: {
      backgroundColor: c.fill,
      color: c.textTertiary,
    },
    error: {
      marginTop: 6,
      fontSize: 13,
      color: c.danger,
    },
    hint: {
      marginTop: 6,
      fontSize: 13,
      color: c.textSecondary,
    },
  })
);
