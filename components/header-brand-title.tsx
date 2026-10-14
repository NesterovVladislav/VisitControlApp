import { HeaderTitle } from '@react-navigation/elements';
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import OrganizationLogo from './organization-logo';
import { useAppSelector } from '../store';

/** Место под кнопку «Назад» и кнопки справа: заголовок с логотипом не должен на них наезжать */
const HEADER_BUTTONS_WIDTH = 150;
const LOGO_SIZE = 28;

interface HeaderBrandTitleProps {
  children: string;
  tintColor?: string;
}

/**
 * Заголовок экрана с логотипом сада слева. Название сада известно сразу после входа, логотип подгружается:
 * до этого и без логотипа — буква названия. У технического администратора сада нет — обычный заголовок.
 */
export default function HeaderBrandTitle({ children, tintColor }: HeaderBrandTitleProps) {
  const { width } = useWindowDimensions();
  const organization = useAppSelector((state) =>
    state.auth.phase === 'authenticated' ? (state.auth.user?.organization ?? null) : null
  );
  const brand = useAppSelector((state) => state.organization.brand);

  if (!organization) {
    return <HeaderTitle tintColor={tintColor}>{children}</HeaderTitle>;
  }
  // Сад последнего входа мог быть другим: чужой логотип не показываем
  const logoUrl = brand?.id === organization.id ? brand.logoUrl : null;
  return (
    <View style={[styles.row, { maxWidth: width - HEADER_BUTTONS_WIDTH }]}>
      <OrganizationLogo key={logoUrl} name={organization.name} logoUrl={logoUrl} size={LOGO_SIZE} />
      {children ? (
        <HeaderTitle tintColor={tintColor} style={styles.title} numberOfLines={1}>
          {children}
        </HeaderTitle>
      ) : null}
    </View>
  );
}

/** Для screenOptions стеков и вкладок: `headerTitle: brandHeaderTitle`. */
export function brandHeaderTitle(props: { children: string; tintColor?: string }) {
  return <HeaderBrandTitle {...props} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    marginLeft: 8,
    flexShrink: 1,
  },
});
