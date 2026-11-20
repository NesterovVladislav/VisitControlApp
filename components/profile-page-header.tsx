import type { ReactNode } from 'react';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space } from '../constants/ui-tokens';
import { makeStyles, usePalette } from '../hooks/use-palette';
import HeaderBrandTitle from './header-brand-title';
import { IconSymbol } from './ui/icon-symbol';

type CompactBackHeaderProps = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
};

export function CompactBackHeader({ title, onBack, backLabel = 'Назад', right }: CompactBackHeaderProps) {
  const colors = usePalette();
  const styles = useStyles();
  return (
    <View style={styles.bar}>
      {onBack && (
        <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <IconSymbol name="arrow.left" size={24} color={colors.text} />
        </Pressable>
      )}
      <View style={[styles.title, !onBack && styles.rootTitle]}>
        <HeaderBrandTitle fitContainer tintColor={colors.text}>{title}</HeaderBrandTitle>
      </View>
      {right}
    </View>
  );
}

function ProfilePageHeader({ back, navigation, options }: NativeStackHeaderProps) {
  const colors = usePalette();
  const styles = useStyles();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.surface}>
      <CompactBackHeader title={options.title ?? ''} onBack={back && options.headerBackVisible !== false ? () => navigation.goBack() : undefined}
        right={options.headerRight?.({ tintColor: colors.text, canGoBack: Boolean(back) })} />
    </SafeAreaView>
  );
}

export function renderProfilePageHeader(props: NativeStackHeaderProps) {
  return <ProfilePageHeader {...props} />;
}

const useStyles = makeStyles(c => StyleSheet.create({
  surface: { backgroundColor: c.card },
  bar: { backgroundColor: c.card, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.separator, flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingStart: space.xxs, paddingEnd: space.lg, gap: space.xxs },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  title: { flex: 1, minWidth: 0 },
  rootTitle: { paddingStart: space.md },
}));
