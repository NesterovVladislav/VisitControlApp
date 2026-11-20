import { StyleSheet } from 'react-native';
import { radius, space } from '../constants/ui-tokens';
import { makeStyles } from '../hooks/use-palette';

export const useProfileLayout = makeStyles(c => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: space.md, gap: space.md },
  block: { backgroundColor: c.card, borderRadius: radius.card, paddingHorizontal: space.lg, paddingVertical: space.md },
}));
