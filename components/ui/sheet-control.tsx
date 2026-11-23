import { Pressable, StyleSheet } from 'react-native';
import { controlHeight } from '../../constants/ui-tokens';
import { usePalette } from '../../hooks/use-palette';
import { IconSymbol } from './icon-symbol';

type Props = { back?: boolean; disabled?: boolean; onPress: () => void };

export function SheetControl({ back = false, disabled, onPress }: Props) {
  const colors = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={back ? 'Назад' : 'Закрыть'}
      accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.muted]}>
      <IconSymbol name={back ? 'arrow.left' : 'xmark'} size={22} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: controlHeight.touch, height: controlHeight.touch, alignItems: 'center', justifyContent: 'center' },
  muted: { opacity: 0.55 },
});
