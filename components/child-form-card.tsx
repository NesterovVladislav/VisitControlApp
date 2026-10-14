import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FormField from './form-field';
import SegmentedControl from './segmented-control';
import { makeStyles } from '../hooks/use-palette';
import { ChildErrors, ChildField, ChildForm, Gender } from '../store/types/registration';
import { formatDate } from '../utils/input-masks';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'FEMALE', label: 'Девочка' },
  { value: 'MALE', label: 'Мальчик' },
];

interface ChildFormCardProps {
  index: number;
  child: ChildForm;
  errors: ChildErrors;
  disabled: boolean;
  onChange: (child: ChildForm, field: ChildField) => void;
  onBlur: (field: ChildField) => void;
  /** Нет — карточка единственная, убирать нечего (профиль, «Добавить ребёнка») */
  onRemove?: () => void;
  /** Заголовок вместо «Ребёнок N» */
  title?: string;
}

/**
 * Ребёнок в заявке родителя: ФИО, дата рождения и пол. Администратор сада проверит его при подтверждении заявки.
 */
export default function ChildFormCard({
  index,
  child,
  errors,
  disabled,
  onChange,
  onBlur,
  onRemove,
  title: customTitle,
}: ChildFormCardProps) {
  const styles = useStyles();
  const title = customTitle ?? `Ребёнок ${index + 1}`;

  function update<K extends ChildField>(field: K, value: ChildForm[K]) {
    onChange({ ...child, [field]: value }, field);
  }

  return (
    <View style={styles.card} accessibilityLabel={title}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onRemove ? (
          <TouchableOpacity
            onPress={onRemove}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Убрать: ${title}`}
          >
            <Text style={styles.remove}>Убрать</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <FormField
        label="Фамилия"
        value={child.surname}
        onChangeText={(value) => update('surname', value)}
        onBlur={() => onBlur('surname')}
        error={errors.surname}
        editable={!disabled}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <FormField
        label="Имя"
        value={child.firstName}
        onChangeText={(value) => update('firstName', value)}
        onBlur={() => onBlur('firstName')}
        error={errors.firstName}
        editable={!disabled}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <FormField
        label="Отчество"
        hint="Если есть"
        value={child.patronymic}
        onChangeText={(value) => update('patronymic', value)}
        onBlur={() => onBlur('patronymic')}
        error={errors.patronymic}
        editable={!disabled}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <FormField
        label="Дата рождения"
        placeholder="ДД.ММ.ГГГГ"
        value={child.birthDate}
        onChangeText={(value) => update('birthDate', formatDate(value))}
        onBlur={() => onBlur('birthDate')}
        error={errors.birthDate}
        editable={!disabled}
        keyboardType="number-pad"
        maxLength={10}
      />
      <SegmentedControl
        label="Пол"
        options={GENDER_OPTIONS}
        value={child.gender}
        onChange={(value) => update('gender', value)}
        error={errors.gender}
        disabled={disabled}
      />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },
    remove: {
      fontSize: 14,
      fontWeight: '500',
      color: c.danger,
    },
  })
);
