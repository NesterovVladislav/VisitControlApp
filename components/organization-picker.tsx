import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import OrganizationLogo from './organization-logo';
import { makeStyles, usePalette } from '../hooks/use-palette';
import { PublicOrganization } from '../store/types/registration';

interface OrganizationPickerProps {
  organizations: PublicOrganization[];
  status: 'idle' | 'loading' | 'loaded' | 'failed';
  /** Ошибка, из-за которой вернулись к выбору сада (сад удалили, пока заполняли форму). */
  error: string | null;
  onSelect: (organization: PublicOrganization) => void;
  onRetry: () => void;
}

/**
 * Первый шаг регистрации: родитель выбирает свой сад по логотипу и названию.
 */
export default function OrganizationPicker({
  organizations,
  status,
  error,
  onSelect,
  onRetry,
}: OrganizationPickerProps) {
  const c = usePalette();
  const styles = useStyles();

  return (
    <View>
      <Text style={styles.title}>Выберите детский сад</Text>
      <Text style={styles.subtitle}>Заявку проверит администратор этого сада</Text>

      {error ? (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      {status === 'failed' ? (
        <Text style={styles.status}>
          Не удалось загрузить список садов.{' '}
          <Text style={styles.link} onPress={onRetry} accessibilityRole="link">
            Повторить
          </Text>
        </Text>
      ) : status !== 'loaded' ? (
        <ActivityIndicator style={styles.loading} color={c.textTertiary} />
      ) : organizations.length === 0 ? (
        <Text style={styles.status}>Пока нет садов, в которые можно подать заявку</Text>
      ) : (
        organizations.map((organization) => (
          <TouchableOpacity
            key={organization.id}
            style={[styles.item, !organization.registrationAvailable && styles.itemDisabled]}
            onPress={() => onSelect(organization)}
            disabled={!organization.registrationAvailable}
            accessibilityRole="button"
            accessibilityState={{ disabled: !organization.registrationAvailable }}
            accessibilityLabel={organization.name}
            accessibilityHint={
              organization.registrationAvailable ? undefined : 'Регистрация в этот сад пока недоступна'
            }
          >
            <OrganizationLogo name={organization.name} logoUrl={organization.logoUrl} />
            <View style={styles.itemText}>
              <Text style={styles.name}>{organization.name}</Text>
              {organization.address ? <Text style={styles.address}>{organization.address}</Text> : null}
              {organization.registrationAvailable ? null : (
                <Text style={styles.unavailable}>Регистрация пока недоступна</Text>
              )}
            </View>
            {organization.registrationAvailable ? <Text style={styles.chevron}>›</Text> : null}
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      marginBottom: 16,
      lineHeight: 21,
    },
    banner: {
      backgroundColor: c.dangerSoft,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    bannerText: {
      color: c.danger,
      fontSize: 14,
      lineHeight: 20,
    },
    status: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 20,
    },
    link: {
      color: c.primary,
      fontWeight: '500',
    },
    loading: {
      marginVertical: 24,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    itemDisabled: {
      opacity: 0.5,
    },
    itemText: {
      flex: 1,
      marginLeft: 12,
    },
    name: {
      fontSize: 16,
      fontWeight: '500',
      color: c.text,
    },
    address: {
      marginTop: 2,
      fontSize: 14,
      color: c.textSecondary,
    },
    unavailable: {
      marginTop: 2,
      fontSize: 13,
      color: c.textTertiary,
    },
    chevron: {
      fontSize: 24,
      color: c.iconMuted,
      marginLeft: 8,
    },
  })
);
