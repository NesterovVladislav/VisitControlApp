import { useState } from 'react';
import { Redirect } from 'expo-router';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton, CodeField, FormCard, FormField, PasswordField, StatusMessage } from '../components/ui';
import { space, typeSize } from '../constants/ui-tokens';
import { makeStyles, useScheme } from '../hooks/use-palette';

function Catalog() {
  const scheme = useScheme();
  const styles = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormCard>
          <Text style={styles.caption}>{scheme === 'dark' ? 'Тёмная тема' : 'Светлая тема'}</Text>
          <FormField label="Email" value={email} onChangeText={setEmail} placeholder="mail@example.org" />
          <PasswordField label="Пароль" value={password} onChangeText={setPassword} hint="Не меньше 8 символов" />
          <FormField label="Поле с ошибкой" defaultValue="example" error="Проверьте адрес электронной почты" />
          <FormField label="Неактивное поле" value="mail@example.org" editable={false} />
          <View style={styles.examples}>
            <CodeField label="Код из письма" value={code} onChangeText={setCode} />
            <CodeField label="Недействительный код" value="123456" onChangeText={() => {}} error="Код больше не действует" disabled />
            <ActionButton label="Подтвердить" onPress={() => setSubmitted(true)} />
            <ActionButton label="Загрузка" onPress={() => {}} loading />
            <ActionButton label="Недоступное действие" onPress={() => {}} disabled />
            <ActionButton label="Очистить форму" variant="text" onPress={() => {
              setEmail('');
              setPassword('');
              setCode('');
              setSubmitted(false);
            }} />
            <StatusMessage message="Пример информационного сообщения" />
            <StatusMessage message="Не удалось сохранить изменения" tone="error" />
            <StatusMessage message={submitted ? 'Форма подтверждена' : 'Изменения сохранены'} tone="success" />
          </View>
        </FormCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function UiKitScreen() {
  return __DEV__ ? <Catalog /> : <Redirect href="/" />;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    content: { alignItems: 'center', padding: space.xl },
      caption: { color: c.textSecondary, fontSize: typeSize.label, marginBottom: space.xl },
    examples: { gap: space.md },
  }),
);
