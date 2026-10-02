import { StyleSheet } from 'react-native';
import { makeStyles } from '../hooks/use-palette';

/**
 * Общие стили экранов «Сада»: строка со стрелкой и подписью, кнопки в шапке и под списком.
 */
export const useGardenStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    rowText: {
      flex: 1,
      marginRight: 12,
    },
    rowSubtitle: {
      marginTop: 2,
      fontSize: 13,
      color: c.textSecondary,
    },
    headerButton: {
      color: c.primary,
      fontSize: 17,
    },
    headerIcon: {
      paddingHorizontal: 4,
    },
    action: {
      paddingVertical: 12,
    },
    actionText: {
      color: c.primary,
      fontSize: 16,
    },
    primaryButton: {
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 10,
      backgroundColor: c.primary,
      alignSelf: 'center',
    },
    primaryButtonText: {
      color: c.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    count: {
      marginLeft: 8,
      fontSize: 16,
      color: c.textSecondary,
    },
  })
);
