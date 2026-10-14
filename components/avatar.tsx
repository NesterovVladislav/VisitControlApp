import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { makeStyles } from '../hooks/use-palette';
import { visitControlApi } from '../services/api';
import { getAuthToken } from '../services/auth/auth-token';

interface AvatarProps {
  firstName: string;
  surname: string;
  /** Путь к фотографии относительно API (`/user/{key}/photo?v=…`); нет фотографии — null */
  photoUrl?: string | null;
  size?: number;
}

/**
 * Фотография человека — взрослого или ребёнка. Без фотографии, без доступа к ней или если она не загрузилась —
 * круг с инициалами. Картинка отдаётся только по токену, поэтому запрос идёт с заголовком авторизации.
 */
export default function Avatar({ firstName, surname, photoUrl, size = 44 }: AvatarProps) {
  const styles = useStyles();
  // Запоминаем, какая именно ссылка не загрузилась: после замены фотографии пробуем снова
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const frame = { width: size, height: size, borderRadius: size / 2 };
  const token = getAuthToken();

  if (photoUrl && token && failedUrl !== photoUrl) {
    return (
      <Image
        source={{ uri: `${visitControlApi.getBaseURL()}${photoUrl}`, headers: { Authorization: `Bearer ${token}` } }}
        // Ключ кэша без токена: после повторного входа картинка не скачивается заново
        cachePolicy="memory-disk"
        recyclingKey={photoUrl}
        style={[styles.image, frame]}
        contentFit="cover"
        onError={() => setFailedUrl(photoUrl)}
        accessible={false}
      />
    );
  }
  return (
    <View
      style={[styles.placeholder, frame]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.initials, { fontSize: size * 0.37 }]}>
        {`${firstName.charAt(0)}${surname.charAt(0)}`.toUpperCase()}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    image: {
      backgroundColor: c.primarySoft,
    },
    placeholder: {
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      fontWeight: '600',
      color: c.primary,
    },
  })
);
