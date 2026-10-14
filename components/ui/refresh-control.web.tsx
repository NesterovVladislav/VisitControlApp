import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControlProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { makeStyles, usePalette } from '../../hooks/use-palette';

type WebRefreshControlProps = RefreshControlProps & {
  /** Список, который react-native-web кладёт внутрь RefreshControl */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Замена «потянуть вниз» в браузере: в react-native-web RefreshControl ничего не рисует и жест не ловит
 * (docs/pwa-ios.md, «Экраны»). Над списком — строка «Обновить»; пока список обновляется — индикатор.
 *
 * Экраны передают её в `refreshControl` как обычно. ScrollView из react-native-web сам оборачивает
 * список в этот элемент и передаёт ему свой `style`.
 */
export function RefreshControl({ refreshing, onRefresh, enabled = true, children, style }: WebRefreshControlProps) {
  const c = usePalette();
  const styles = useStyles();

  return (
    <View style={[style, styles.container]}>
      {enabled ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Обновить"
          accessibilityState={{ busy: refreshing, disabled: refreshing }}
          disabled={refreshing}
          onPress={() => onRefresh?.()}
          style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={c.textSecondary} />
          ) : (
            <Text style={styles.label}>↻ Обновить</Text>
          )}
        </Pressable>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    container: {
      flexDirection: 'column',
      // Отступы списка уже внутри него, обёртке они не нужны
      padding: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
      paddingTop: 0,
      paddingBottom: 0,
    },
    bar: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 36,
    },
    barPressed: {
      opacity: 0.5,
    },
    label: {
      color: c.primary,
      fontSize: 15,
    },
    content: {
      flex: 1,
    },
  })
);
