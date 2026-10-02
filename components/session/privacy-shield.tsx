import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { makeStyles, usePalette } from '../../hooks/use-palette';

export function PrivacyShield() {
  const c = usePalette();
  const styles = useStyles();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Visit Control защищает данные"
      style={styles.container}
      testID="privacy-shield"
    >
      <Text style={styles.title}>Visit Control</Text>
      <ActivityIndicator color={c.onShield} size="large" />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      backgroundColor: c.shield,
      justifyContent: 'center',
      zIndex: 10_000,
    },
    title: {
      color: c.onShield,
      fontSize: 28,
      fontWeight: '700',
      marginBottom: 24,
    },
  })
);
