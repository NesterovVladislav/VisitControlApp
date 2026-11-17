import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { controlHeight, space } from '../constants/ui-tokens';
import { IconSymbol } from '@/components/ui/icon-symbol';
import FormField, { FormFieldProps } from './form-field';
import { usePalette } from '../hooks/use-palette';

/**
 * Поле пароля с кнопкой «показать пароль». Автоисправление и автозаглавные выключены.
 */
export default function PasswordField(props: Omit<FormFieldProps, 'secureTextEntry' | 'accessory'>) {
  const c = usePalette();
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      {...props}
      secureTextEntry={!visible}
      accessory={
        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setVisible((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Скрыть пароль' : 'Показать пароль'}
          disabled={props.editable === false}
          accessibilityState={{ disabled: props.editable === false }}
        >
          <IconSymbol name={visible ? 'eye.slash' : 'eye'} size={22} color={props.editable === false ? c.textTertiary : c.textSecondary} />
        </TouchableOpacity>
      }
    />
  );
}

const styles = StyleSheet.create({
  toggle: {
    minHeight: controlHeight.touch,
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
});
