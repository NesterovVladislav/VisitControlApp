import { StyleSheet, Text, View } from 'react-native';

import { radius, space, typeSize } from '../../constants/ui-tokens';
import { makeStyles } from '../../hooks/use-palette';

export function StatusMessage({ message, tone = 'info' }: {
  message: string;
  tone?: 'info' | 'error' | 'success';
}) {
  const styles = useStyles();
  return (
    <View style={[styles.box, tone === 'error' && styles.errorBox]} accessibilityLiveRegion="polite">
      <Text style={[styles.text, tone === 'error' && styles.error, tone === 'success' && styles.success]}>
        {message}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    box: { backgroundColor: c.fill, borderRadius: radius.control, padding: space.md },
    errorBox: { backgroundColor: c.dangerSoft },
    text: { color: c.text, fontSize: typeSize.label, lineHeight: space.xl },
    error: { color: c.danger },
    success: { color: c.success },
  }),
);
