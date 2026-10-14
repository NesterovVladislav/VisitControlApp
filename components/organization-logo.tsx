import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { makeStyles } from '../hooks/use-palette';

interface OrganizationLogoProps {
  name: string;
  logoUrl: string | null;
  size?: number;
}

/**
 * Логотип сада. Без логотипа или если картинка не загрузилась — первая буква названия.
 */
export default function OrganizationLogo({ name, logoUrl, size = 48 }: OrganizationLogoProps) {
  const styles = useStyles();
  const [failed, setFailed] = useState(false);
  const frame = { width: size, height: size, borderRadius: size / 4 };

  if (logoUrl && !failed) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[styles.image, frame]}
        resizeMode="contain"
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  return (
    <View style={[styles.placeholder, frame]} accessible={false}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{firstLetter(name)}</Text>
    </View>
  );
}

/** Первая буква или цифра названия: у «Сад №5» это «С», у «"Ромашка"» — «Р». */
function firstLetter(name: string): string {
  const match = /[\p{L}\p{N}]/u.exec(name);
  return match ? match[0].toUpperCase() : '?';
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    image: {
      backgroundColor: c.card,
    },
    placeholder: {
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    letter: {
      fontWeight: '600',
      color: c.primary,
    },
  })
);
