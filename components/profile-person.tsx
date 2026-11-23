import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Avatar from './avatar';
import { useProfileLayout } from './profile-layout';
import { space, typeSize } from '../constants/ui-tokens';
import { makeStyles } from '../hooks/use-palette';
import { personName } from '../utils/people-format';

type PersonProps = { firstName: string; surname: string; photoUrl?: string | null; subtitle?: string; children?: ReactNode };

export function ProfileIdentity({ firstName, surname, photoUrl, subtitle, children }: PersonProps) {
  const styles = useStyles();
  return <View style={styles.identity}>
    <Avatar firstName={firstName} surname={surname} photoUrl={photoUrl} size={52} />
    <View style={styles.copy}>
      <Text style={styles.name}>{personName({ surname, firstName })}</Text>
      {subtitle ? <Text style={styles.label}>{subtitle}</Text> : null}
      {children}
    </View>
  </View>;
}

export function ProfileFields({ fields }: { fields: [string, string | null | undefined][] }) {
  const layout = useProfileLayout();
  const styles = useStyles();
  return <View style={layout.block}>
    {fields.map(([label, value], index) => <View key={label} style={[styles.field, index > 0 && styles.divider]}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>{value || '—'}</Text>
    </View>)}
  </View>;
}

const useStyles = makeStyles(c => StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  copy: { flex: 1, minWidth: 0, gap: space.xxs },
  name: { color: c.text, fontSize: typeSize.sheetTitle, fontWeight: '600' },
  label: { color: c.textSecondary, fontSize: typeSize.caption },
  field: { paddingVertical: space.sm, gap: space.xxs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  value: { color: c.text, fontSize: typeSize.body },
}));
