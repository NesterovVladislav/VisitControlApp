import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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

/** Сколько фотографий держать в памяти страницы. Старые вытесняются. */
const MAX_CACHED_PHOTOS = 100;
/** Ключ — путь с версией (`?v=`): после замены фотографии путь другой, и она скачивается заново. */
const photoCache = new Map<string, Promise<string>>();

function cachePhoto(photoUrl: string, objectUrl: Promise<string>): void {
  photoCache.set(photoUrl, objectUrl);
  if (photoCache.size <= MAX_CACHED_PHOTOS) return;
  const oldest = photoCache.keys().next().value;
  if (oldest === undefined) return;
  const evicted = photoCache.get(oldest);
  photoCache.delete(oldest);
  evicted?.then((url) => URL.revokeObjectURL(url)).catch(() => {});
}

function loadPhoto(photoUrl: string, token: string): Promise<string> {
  const cached = photoCache.get(photoUrl);
  if (cached) return cached;

  const objectUrl = fetch(`${visitControlApi.getBaseURL()}${photoUrl}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Photo request failed: ${response.status}`);
    return URL.createObjectURL(await response.blob());
  });
  cachePhoto(photoUrl, objectUrl);
  // Неудачную загрузку не запоминаем: в следующий раз попробуем снова
  objectUrl.catch(() => {
    if (photoCache.get(photoUrl) === objectUrl) photoCache.delete(photoUrl);
  });
  return objectUrl;
}

/**
 * Браузерная версия avatar.tsx. Картинка отдаётся только по токену, а тег изображения в браузере
 * заголовок авторизации передать не может (docs/pwa-ios.md, «Отдельные функции»). Поэтому фотография
 * скачивается запросом с заголовком и показывается из памяти страницы. Пока она грузится,
 * не загрузилась или её нет — круг с инициалами, как на телефоне.
 */
export default function Avatar({ firstName, surname, photoUrl, size = 44 }: AvatarProps) {
  const styles = useStyles();
  const [loaded, setLoaded] = useState<{ photoUrl: string; objectUrl: string } | null>(null);
  const frame = { width: size, height: size, borderRadius: size / 2 };
  const token = getAuthToken();

  useEffect(() => {
    if (!photoUrl || !token) return;
    let active = true;
    loadPhoto(photoUrl, token)
      .then((objectUrl) => {
        if (active) setLoaded({ photoUrl, objectUrl });
      })
      .catch(() => {
        // Нет доступа или нет сети — остаются инициалы
      });
    return () => {
      active = false;
    };
  }, [photoUrl, token]);

  if (photoUrl && token && loaded?.photoUrl === photoUrl) {
    return (
      <Image
        source={{ uri: loaded.objectUrl }}
        style={[styles.image, frame]}
        resizeMode="cover"
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
