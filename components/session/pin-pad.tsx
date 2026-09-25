import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type PinPadProps = {
  onSubmit(pin: string): void;
  disabled?: boolean;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'delete'] as const;

export function PinPad({ onSubmit, disabled = false }: PinPadProps) {
  const [digits, setDigits] = useState('');

  const enterDigit = (digit: string) => {
    if (disabled || digits.length >= 4) return;
    const next = digits + digit;
    if (next.length === 4) {
      setDigits('');
      onSubmit(next);
      return;
    }
    setDigits(next);
  };

  const deleteDigit = () => {
    if (disabled) return;
    setDigits((current) => current.slice(0, -1));
  };

  return (
    <View>
      <View
        accessibilityLabel={'Введено ' + digits.length + ' из 4 цифр'}
        style={styles.indicators}
        testID="pin-indicators"
      >
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[styles.indicator, index < digits.length && styles.indicatorFilled]}
          />
        ))}
      </View>

      <View style={styles.grid}>
        {KEYS.map((key) => {
          if (key === 'empty') {
            return <View key={key} style={styles.key} />;
          }
          const isDelete = key === 'delete';
          const label = isDelete ? 'Удалить цифру' : 'Цифра ' + key;
          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              disabled={disabled}
              key={key}
              onPress={isDelete ? deleteDigit : () => enterDigit(key)}
              style={({ pressed }) => [
                styles.key,
                styles.keyButton,
                pressed && !disabled && styles.keyPressed,
                disabled && styles.keyDisabled,
              ]}
            >
              <Text style={styles.keyText}>{isDelete ? '⌫' : key}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 28,
  },
  indicator: {
    borderColor: '#1D3557',
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    marginHorizontal: 8,
    width: 16,
  },
  indicatorFilled: {
    backgroundColor: '#1D3557',
  },
  grid: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 264,
  },
  key: {
    height: 72,
    margin: 8,
    width: 72,
  },
  keyButton: {
    alignItems: 'center',
    backgroundColor: '#F1F4F8',
    borderRadius: 36,
    justifyContent: 'center',
  },
  keyDisabled: {
    opacity: 0.45,
  },
  keyPressed: {
    backgroundColor: '#DCE6F2',
  },
  keyText: {
    color: '#1D3557',
    fontSize: 26,
    fontWeight: '600',
  },
});
