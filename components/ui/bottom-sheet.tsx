import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, typeSize } from '../../constants/ui-tokens';
import { makeStyles } from '../../hooks/use-palette';
import { ActionButton } from './action-button';

type Props = {
  title: string;
  onClose: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export function BottomSheet({ title, onClose, closeLabel = 'Закрыть', closeDisabled, children, footer }: Props) {
  const styles = useStyles();
  const { bottom } = useSafeAreaInsets();
  const bottomPadding = Math.max(bottom, space.lg);

  return (
    <Modal transparent animationType="slide" accessibilityLabel={title} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <View accessible={false} importantForAccessibility="no" aria-hidden
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => !closeDisabled}
          onResponderRelease={onClose} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <ActionButton label={closeLabel} variant="text" disabled={closeDisabled} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[
            styles.content, { paddingBottom: footer ? space.lg : bottomPadding },
          ]}>
            {children}
          </ScrollView>
          {footer && <View style={[styles.footer, { paddingBottom: bottomPadding }]}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: space.lg, borderTopRightRadius: space.lg,
    alignSelf: 'center', width: '100%', maxWidth: 480, maxHeight: '88%' },
  header: { paddingTop: space.sm, paddingHorizontal: space.lg, gap: space.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: typeSize.sheetTitle, fontWeight: '700', color: c.text },
  content: { gap: space.lg, paddingHorizontal: space.lg, paddingTop: space.md },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
}));
