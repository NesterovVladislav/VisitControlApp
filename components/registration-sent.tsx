import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { makeStyles } from '../hooks/use-palette';

interface Props {
  email: string | null;
  onDone: () => void;
}

/**
 * Итог отправки заявки. Показывается на месте формы: переход на отдельный экран
 * в момент отправки (с открытой клавиатурой и защитой от ухода с формы) ронял приложение.
 */
export default function RegistrationSent({ email, onDone }: Props) {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
          ✉️
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          Заявка отправлена
        </Text>
        <Text style={styles.text}>
          Ваша заявка направлена администратору и будет рассмотрена в ближайшее время.
        </Text>
        <Text style={styles.text}>
          После подтверждения пароль для входа придёт на почту
          {email ? (
            <>
              {' '}
              <Text style={styles.email}>{email}</Text>
            </>
          ) : null}
          .
        </Text>
        <Text style={styles.note}>
          Если письмо долго не приходит, проверьте папку «Спам» или обратитесь к администратору сада.
        </Text>
        <TouchableOpacity style={styles.button} onPress={onDone} accessibilityRole="button">
          <Text style={styles.buttonText}>Понятно</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.background,
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 24,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    icon: {
      fontSize: 40,
      textAlign: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 16,
      textAlign: 'center',
      color: c.text,
    },
    text: {
      fontSize: 16,
      lineHeight: 23,
      color: c.text,
      marginBottom: 12,
    },
    email: {
      fontWeight: '600',
    },
    note: {
      fontSize: 14,
      lineHeight: 20,
      color: c.textSecondary,
      marginBottom: 24,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
    },
    buttonText: {
      color: c.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  })
);
