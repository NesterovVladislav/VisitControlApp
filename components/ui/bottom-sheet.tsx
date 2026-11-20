import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, typeSize } from '../../constants/ui-tokens';
import { makeStyles } from '../../hooks/use-palette';
import { SheetControl } from './sheet-control';

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
  const offset = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    const entrance = Animated.timing(offset, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
  }, [offset]);
  const bottomPadding = Math.max(bottom, space.lg);

  return (
    <Modal transparent animationType="fade" accessibilityLabel={title} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <View accessible={false} importantForAccessibility="no" aria-hidden
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => !closeDisabled}
          onResponderRelease={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: offset }] }]} accessibilityViewIsModal>
          <View style={styles.header}>
            {closeLabel === 'Назад' && <SheetControl back disabled={closeDisabled} onPress={onClose} />}
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {closeLabel !== 'Назад' && <SheetControl disabled={closeDisabled} onPress={onClose} />}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[
            styles.content, { paddingBottom: footer ? space.lg : bottomPadding },
          ]}>
            {children}
          </ScrollView>
          {footer && <View style={[styles.footer, { paddingBottom: bottomPadding }]}>{footer}</View>}
        </Animated.View>
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
