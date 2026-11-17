import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { controlHeight, radius, space, typeSize } from '../../constants/ui-tokens';
import { makeStyles, usePalette } from '../../hooks/use-palette';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'text';
  role?: 'button' | 'link';
};

export function ActionButton({
  label, onPress, disabled = false, loading = false, variant = 'primary', role = 'button',
}: Props) {
  const styles = useStyles();
  const colors = usePalette();
  const [focused, setFocused] = useState(false);
  const blocked = disabled || loading;
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      aria-busy={loading || undefined}
      disabled={blocked}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        primary && styles.primary,
        primary && blocked && styles.inactive,
        pressed && styles.pressed,
        focused && !blocked && styles.focused,
      ]}
    >
      {loading ? <ActivityIndicator color={primary ? colors.text : colors.primary} /> : (
        <Text style={[styles.label, primary && styles.primaryLabel, blocked && styles.inactiveLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: controlHeight.touch,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.control,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    primary: { minHeight: controlHeight.action, backgroundColor: c.actionPrimary },
    inactive: { backgroundColor: c.fill },
    pressed: { opacity: 0.8 },
    focused: { borderColor: c.text },
    label: { color: c.actionPrimary, fontSize: typeSize.label, fontWeight: '600', textAlign: 'center' },
    primaryLabel: { color: c.onActionPrimary, fontSize: typeSize.body },
    inactiveLabel: { color: c.textSecondary },
  }),
);
