import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import FormField, { FormFieldProps } from './form-field';
import { makeStyles, usePalette } from '../hooks/use-palette';

/**
 * Поле пароля с кнопкой «показать пароль». Автоисправление и автозаглавные выключены.
 */
export default function PasswordField(props: Omit<FormFieldProps, 'secureTextEntry' | 'accessory'>) {
  const c = usePalette();
  const styles = useStyles();
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
          hitSlop={8}
        >
          <IconSymbol name={visible ? 'eye.slash' : 'eye'} size={22} color={c.textTertiary} />
        </TouchableOpacity>
      }
    />
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    toggle: {
      paddingHorizontal: 12,
    },
  })
);
