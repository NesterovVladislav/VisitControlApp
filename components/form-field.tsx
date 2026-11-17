import React, { useState } from 'react';
import { controlHeight, radius, space, typeSize } from '../constants/ui-tokens';
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
  onFocus,
  onBlur,
  ...inputProps
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
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
            focused && editable && styles.inputFocused,
            error && styles.inputError,
            !editable && styles.inputDisabled,
            accessory ? styles.inputWithAccessory : null,
            style,
          ]}
          placeholderTextColor={c.placeholder}
          editable={editable}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
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
      marginTop: space.xs,
      fontSize: typeSize.caption,
      color: c.danger,
    },
  })
);

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    container: {
      marginBottom: space.lg,
    },
    label: {
      fontSize: typeSize.label,
      fontWeight: '600',
      marginBottom: space.sm,
      color: c.text,
    },
    input: {
      minHeight: controlHeight.field,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.control,
      padding: space.md,
      fontSize: typeSize.body,
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
    inputFocused: {
      borderColor: c.actionPrimary,
    },
    inputError: {
      borderColor: c.danger,
    },
    inputDisabled: {
      backgroundColor: c.fill,
      color: c.textTertiary,
    },
    error: {
      marginTop: space.xs,
      fontSize: typeSize.caption,
      color: c.danger,
    },
    hint: {
      marginTop: space.xs,
      fontSize: typeSize.caption,
      color: c.textSecondary,
    },
  })
);
