import type { ReactNode } from 'react';
import { Modal, Platform, StyleSheet, type ModalProps } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

/** System bars belong to each Android window, including native modal dialogs. */
export function AndroidSafeWindow({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'android') return <>{children}</>;
  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.fill}>
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export function AppModal({ children, ...props }: ModalProps) {
  return <Modal {...props}><AndroidSafeWindow>{children}</AndroidSafeWindow></Modal>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
