import { useSyncExternalStore } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles } from '../hooks/use-palette';
import {
  currentWebAlert,
  dismissWebAlert,
  isVerticalLayout,
  orderWebAlertButtons,
  pressWebAlertButton,
  showWebAlert,
  subscribeWebAlerts,
} from '../services/ui/web-alert-queue';

// В react-native-web Alert.alert пустой. Подменяем один раз при загрузке: все экраны вызывают
// Alert.alert из 'react-native' и получают этот диалог без правок (docs/pwa-ios.md, «Экраны»).
Alert.alert = showWebAlert;

/**
 * Диалог вместо системного Alert в браузере. Своё окно Modal: так диалог оказывается поверх открытых
 * шторок, как системный.
 */
export function WebAlertHost() {
  const styles = useStyles();
  const request = useSyncExternalStore(subscribeWebAlerts, currentWebAlert, currentWebAlert);

  if (!request) return null;

  const buttons = orderWebAlertButtons(request.buttons);
  const vertical = isVerticalLayout(request.buttons);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => dismissWebAlert(request.id)}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => dismissWebAlert(request.id)}
          accessible={false}
        />
        <View style={styles.dialog} accessibilityRole="alert" accessibilityViewIsModal>
          <View style={styles.body}>
            <Text style={styles.title}>{request.title}</Text>
            {request.message ? <Text style={styles.message}>{request.message}</Text> : null}
          </View>
          <View style={vertical ? styles.column : styles.row}>
            {buttons.map((button, index) => (
              <Pressable
                key={`${index}-${button.text ?? ''}`}
                accessibilityRole="button"
                onPress={() => pressWebAlertButton(request.id, button)}
                style={({ pressed }) => [
                  styles.button,
                  vertical ? styles.buttonColumn : styles.buttonRow,
                  !vertical && index > 0 && styles.buttonDivider,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'cancel' && styles.cancelText,
                    button.style === 'destructive' && styles.destructiveText,
                  ]}
                >
                  {button.text ?? 'OK'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.overlay,
      padding: 32,
    },
    dialog: {
      width: '100%',
      maxWidth: 300,
      borderRadius: 14,
      backgroundColor: c.card,
      overflow: 'hidden',
    },
    body: {
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 16,
    },
    title: {
      color: c.text,
      fontSize: 17,
      fontWeight: '600',
      textAlign: 'center',
    },
    message: {
      color: c.text,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 4,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
    },
    column: {
      flexDirection: 'column',
    },
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 8,
      paddingVertical: 11,
    },
    buttonRow: {
      flex: 1,
    },
    buttonColumn: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
    },
    buttonDivider: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: c.separator,
    },
    buttonPressed: {
      backgroundColor: c.fill,
    },
    buttonText: {
      color: c.primary,
      fontSize: 17,
      textAlign: 'center',
    },
    cancelText: {
      fontWeight: '600',
    },
    destructiveText: {
      color: c.danger,
    },
  })
);
