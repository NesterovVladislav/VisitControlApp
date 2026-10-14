import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { visitControlApi } from '../services/api';
import { HandoverResult } from '../store/types/visits';
import { handoverErrorMessage, handoverResultDetail, handoverResultTitle, isHandoverCode } from '../utils/handover';

interface QrScannerSheetProps {
  visible: boolean;
  /** Ребёнок принят или отдан: очередь и «Кто в саду» нужно перечитать */
  onScanned: () => void;
  onClose: () => void;
}

type ScanState =
  | { kind: 'scanning' }
  | { kind: 'sending' }
  | { kind: 'done'; result: HandoverResult }
  | { kind: 'failed'; message: string };

/**
 * Сканер QR-кода родителя: один скан — ребёнок принят или отдан. Камера работает, только пока идёт сканирование;
 * после каждого кода — результат и «Сканировать ещё».
 */
export default function QrScannerSheet({ visible, onScanned, onClose }: QrScannerSheetProps) {
  const c = usePalette();
  const styles = useStyles();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ kind: 'scanning' });
  // Камера отдаёт один и тот же код много раз в секунду: берём первый
  const busy = useRef(false);

  useEffect(() => {
    if (visible) {
      busy.current = false;
      setState({ kind: 'scanning' });
    }
  }, [visible]);

  async function handleScan(data: string) {
    if (busy.current) {
      return;
    }
    busy.current = true;
    if (!isHandoverCode(data)) {
      setState({ kind: 'failed', message: 'Это не код Visit Control. Попросите родителя открыть QR-код ребёнка' });
      return;
    }
    setState({ kind: 'sending' });
    try {
      const result = await visitControlApi.redeemHandover(data.trim());
      setState({ kind: 'done', result });
      onScanned();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      const message = handoverErrorMessage(error);
      if (message === null) {
        onClose();
        return;
      }
      setState({ kind: 'failed', message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }

  function scanAgain() {
    busy.current = false;
    setState({ kind: 'scanning' });
  }

  let body: React.ReactNode;
  if (!permission) {
    body = <ActivityIndicator color={c.primary} />;
  } else if (!permission.granted) {
    body = (
      <View style={styles.message}>
        <Text style={styles.title}>Нужен доступ к камере</Text>
        <Text style={styles.text}>
          Камера нужна, чтобы сканировать QR-код родителя. Без неё детей можно принимать и отдавать кнопками
          в очереди.
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity style={styles.primary} onPress={requestPermission} accessibilityRole="button">
            <Text style={styles.primaryText}>Разрешить камеру</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primary} onPress={() => Linking.openSettings()} accessibilityRole="button">
            <Text style={styles.primaryText}>Открыть настройки</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  } else if (state.kind === 'done') {
    body = (
      <View style={styles.message}>
        <Text style={styles.doneMark}>✓</Text>
        <Text style={styles.title}>{handoverResultTitle(state.result)}</Text>
        <Text style={styles.text}>{handoverResultDetail(state.result)}</Text>
        <TouchableOpacity style={styles.primary} onPress={scanAgain} accessibilityRole="button">
          <Text style={styles.primaryText}>Сканировать ещё</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={onClose} accessibilityRole="button">
          <Text style={styles.secondaryText}>Готово</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (state.kind === 'failed') {
    body = (
      <View style={styles.message}>
        <Text style={styles.title}>Не получилось</Text>
        <Text style={styles.text}>{state.message}</Text>
        <TouchableOpacity style={styles.primary} onPress={scanAgain} accessibilityRole="button">
          <Text style={styles.primaryText}>Сканировать ещё раз</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    body = (
      <View style={styles.cameraBox}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={state.kind === 'scanning' ? ({ data }) => handleScan(data) : undefined}
        />
        <Text style={styles.cameraHint}>
          {state.kind === 'sending' ? 'Проверяем код…' : 'Наведите камеру на QR-код на телефоне родителя'}
        </Text>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Сканировать QR</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.close}>Закрыть</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.body}>{body}</View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 28,
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
    },
    close: {
      fontSize: 16,
      color: c.primary,
    },
    body: {
      flex: 1,
      justifyContent: 'center',
    },
    cameraBox: {
      flex: 1,
    },
    camera: {
      flex: 1,
    },
    cameraHint: {
      paddingHorizontal: 20,
      paddingVertical: 18,
      fontSize: 16,
      color: c.text,
      textAlign: 'center',
    },
    message: {
      alignItems: 'center',
      padding: 24,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: c.text,
      textAlign: 'center',
    },
    text: {
      marginTop: 8,
      fontSize: 16,
      lineHeight: 22,
      color: c.textSecondary,
      textAlign: 'center',
    },
    doneMark: {
      fontSize: 64,
      color: c.success,
    },
    primary: {
      alignSelf: 'stretch',
      minHeight: 48,
      marginTop: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    primaryText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.onPrimary,
    },
    secondary: {
      alignSelf: 'stretch',
      minHeight: 48,
      marginTop: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fill,
    },
    secondaryText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.primary,
    },
  })
);
