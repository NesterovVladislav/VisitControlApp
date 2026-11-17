import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { makeStyles } from '../hooks/use-palette';

/** iPhone или iPad. iPadOS называет себя Mac, но у Mac нет сенсорного экрана. */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Открыто с иконки на экране «Домой», а не в Safari. */
function isStandalone(): boolean {
  const legacy = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return legacy || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function shouldShow(): boolean {
  if (typeof window === 'undefined') return false;
  return isAppleMobile(window.navigator.userAgent, window.navigator.maxTouchPoints ?? 0) && !isStandalone();
}

/**
 * Инструкция по установке на экране входа (docs/pwa-ios.md, «Доставка на iPhone»). Системной подсказки
 * «Установить» на iOS нет. Показывается только на iPhone и iPad в браузере; в установленном
 * приложении и на компьютере — нет.
 */
export default function InstallHint() {
  const styles = useStyles();
  const [visible] = useState(shouldShow);

  if (!visible) return null;

  return (
    <View style={styles.box} accessibilityRole="summary">
      <Text style={styles.title}>Установите приложение на iPhone</Text>
      <Text style={styles.step}>1. В Safari нажмите «Поделиться» — квадрат со стрелкой вверх.</Text>
      <Text style={styles.step}>2. Выберите «На экран „Домой“» и нажмите «Добавить».</Text>
      <Text style={styles.step}>3. Открывайте ДоброВход с иконки на экране «Домой».</Text>
      <Text style={styles.note}>
        Нет пункта «На экран „Домой“»? Откройте эту страницу в Safari, а не внутри Telegram или почты.
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    box: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    title: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    step: {
      color: c.text,
      fontSize: 14,
      lineHeight: 20,
    },
    note: {
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 8,
    },
  })
);
