import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AdminPlaceholderProps {
  /** Что будет в разделе — одна-две строки из docs/admin-screens.md */
  description: string;
}

/**
 * Заглушка вкладки администратора, пока раздел не реализован.
 */
export default function AdminPlaceholder({ description }: AdminPlaceholderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Раздел в разработке</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 21,
  },
});
