import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { makeStyles } from '../hooks/use-palette';

interface AdminPlaceholderProps {
  /** Что будет в разделе — одна-две строки из docs/admin-screens.md */
  description: string;
}

/**
 * Заглушка вкладки администратора, пока раздел не реализован.
 */
export default function AdminPlaceholder({ description }: AdminPlaceholderProps) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Раздел в разработке</Text>
      <Text style={styles.description}>{description}</Text>
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
      padding: 32,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: c.text,
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
  })
);
