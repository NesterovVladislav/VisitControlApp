import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { controlHeight, radius, space, typeSize } from '../../constants/ui-tokens';
import { makeStyles } from '../../hooks/use-palette';

const CODE_LENGTH = 6;

export function CodeField({
  label, value, onChangeText, error, disabled = false, inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  disabled?: boolean;
  inputRef?: React.Ref<TextInput>;
}) {
  const styles = useStyles();
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.control}>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          pointerEvents="none"
          style={styles.cells}
        >
          {Array.from({ length: CODE_LENGTH }, (_, index) => (
            <View
              key={index}
              style={[
                styles.cell,
                disabled && styles.disabled,
                focused && index === Math.min(value.length, CODE_LENGTH - 1) && styles.focused,
                error && styles.invalid,
              ]}
            >
              <Text style={styles.digit}>{value[index]}</Text>
            </View>
          ))}
        </View>
        <TextInput
          ref={inputRef}
          style={styles.input}
          accessibilityLabel={label}
          accessibilityHint={error}
          editable={!disabled}
          inputMode="numeric"
          autoComplete={Platform.OS === 'ios' ? undefined : 'one-time-code'}
          textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          caretHidden
          contextMenuHidden={false}
        />
      </View>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    label: { color: c.text, fontSize: typeSize.label, fontWeight: '600', marginBottom: space.sm },
    control: { position: 'relative' },
    cells: { flexDirection: 'row', gap: space.xxs },
    cell: {
      flex: 1,
      minHeight: controlHeight.field,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: radius.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: { backgroundColor: c.fill },
    focused: { borderColor: c.actionPrimary, borderWidth: 2 },
    invalid: { borderColor: c.danger },
    digit: { color: c.text, fontSize: typeSize.body, fontWeight: '600' },
    input: {
      ...StyleSheet.absoluteFillObject,
      color: 'transparent',
      fontSize: typeSize.body,
      // Chromium draws its automatic focus outline even at zero width. The cells show focus.
      ...Platform.select({ web: { outlineStyle: 'solid', outlineWidth: 0 } as const }),
    },
    error: { color: c.danger, fontSize: typeSize.caption, marginTop: space.xs },
  }),
);
