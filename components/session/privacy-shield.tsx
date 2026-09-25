import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function PrivacyShield() {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Visit Control защищает данные"
      style={styles.container}
      testID="privacy-shield"
    >
      <Text style={styles.title}>Visit Control</Text>
      <ActivityIndicator color="#ffffff" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: '#1D3557',
    justifyContent: 'center',
    zIndex: 10_000,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
});
