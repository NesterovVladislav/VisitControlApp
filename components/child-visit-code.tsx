import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { space } from '../constants/ui-tokens';

export default function QrCode({ token }: { token: string }) {
  const { width } = useWindowDimensions();
  useKeepAwake();

  useEffect(() => {
    let previous: number | null = null;
    let cancelled = false;
    (async () => {
      try {
        previous = await Brightness.getBrightnessAsync();
        if (!cancelled) await Brightness.setBrightnessAsync(1);
      } catch {
        // Яркость доступна не на всех платформах.
      }
    })();
    return () => {
      cancelled = true;
      const restore = Platform.OS === 'android' ? Brightness.restoreSystemBrightnessAsync()
        : previous === null ? Promise.resolve() : Brightness.setBrightnessAsync(previous);
      restore.catch(() => {});
    };
  }, []);

  return <View style={styles.qrBox} accessibilityLabel="QR-код ребёнка">
    <QRCode value={token} size={Math.min(260, width - 2 * (space.lg + space.xxl))} backgroundColor="#fff" color="#000" />
  </View>;
}

const styles = StyleSheet.create({
  qrBox: { alignSelf: 'center', padding: space.xxl, backgroundColor: '#fff' },
});
