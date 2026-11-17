import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space } from '../../constants/ui-tokens';
import { makeStyles } from '../../hooks/use-palette';

export function FormCard({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.card}>{children}</View>;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: c.card,
      borderRadius: radius.card,
      padding: space.xxl,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  }),
);
