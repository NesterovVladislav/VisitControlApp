import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSessionLifecycle } from '../../hooks/use-session-lifecycle';
import { useAppDispatch, useAppSelector } from '../../store';
import { bootstrapSession } from '../../store/reducers/auth';
import { AuthPhase } from '../../store/types/auth';
import { renderProfilePageHeader } from '../profile-page-header';
import { brandHeaderTitle } from '../header-brand-title';
import { BiometricSetupScreen } from './biometric-setup-screen';
import { CreatePinScreen } from './create-pin-screen';
import { PrivacyShield } from './privacy-shield';
import { StorageErrorScreen } from './storage-error-screen';
import { UnlockScreen } from './unlock-screen';

function SessionNavigator({ phase }: { phase: AuthPhase }) {
  const publicRoutes = phase === 'unauthenticated';
  const protectedRoutes = phase === 'authenticated';

  return (
    // Логотип сада в шапке; до входа сада нет — заголовок обычный
    <Stack screenOptions={{ headerTitle: brandHeaderTitle }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="ui-kit" options={{ title: 'UI Kit' }} />
      </Stack.Protected>
      <Stack.Protected guard={publicRoutes}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="password-reset" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen
          name="register"
          options={{ title: 'Регистрация', headerBackTitle: 'Назад' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={protectedRoutes}>
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen
          name="children"
          options={{
            gestureEnabled: false,
            header: renderProfilePageHeader,
            headerBackVisible: false,
            title: 'Главная',
          }}
        />
        <Stack.Screen
          name="child-attendance"
          options={{ title: 'Посещения', headerBackTitle: 'Мои дети' }}
        />
        <Stack.Screen
          name="profile/index"
          options={{ header: renderProfilePageHeader, title: 'Профиль', headerBackTitle: 'Назад' }}
        />
        <Stack.Screen name="profile/delete-account" options={{ header: renderProfilePageHeader, title: 'Удаление аккаунта', headerBackTitle: 'Профиль' }} />
        <Stack.Screen name="profile/about" options={{ header: renderProfilePageHeader, title: 'О приложении', headerBackTitle: 'Профиль' }} />
        <Stack.Screen name="profile/details" options={{ header: renderProfilePageHeader, title: 'Личные данные', headerBackTitle: 'Профиль' }} />
        <Stack.Screen name="profile/theme" options={{ header: renderProfilePageHeader, title: 'Тема', headerBackTitle: 'Профиль' }} />
        <Stack.Screen
          name="profile/edit"
          options={{ header: renderProfilePageHeader, title: 'Редактирование', headerBackTitle: 'Назад' }}
        />
        <Stack.Screen
          name="profile/password"
          options={{ header: renderProfilePageHeader, title: 'Смена пароля', headerBackTitle: 'Профиль' }}
        />
        <Stack.Screen
          name="profile/child/[id]"
          options={{ header: renderProfilePageHeader, title: 'Данные ребёнка', headerBackTitle: 'Профиль' }}
        />
        <Stack.Screen name="profile/child/edit/[id]" options={{ header: renderProfilePageHeader,
          title: 'Редактирование', headerBackTitle: 'Данные ребёнка' }} />
        <Stack.Screen
          name="profile/add-child"
          options={{ header: renderProfilePageHeader, title: 'Добавить ребёнка', headerBackTitle: 'Профиль' }}
        />
        <Stack.Screen name="menu" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Modal' }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export function SessionGate() {
  const dispatch = useAppDispatch();
  const { phase, setupStep } = useAppSelector((state) => state.auth);
  const { privacyShieldVisible } = useSessionLifecycle(phase);
  const bootstrapRequested = useRef(false);

  useEffect(() => {
    if (bootstrapRequested.current) return;
    bootstrapRequested.current = true;
    dispatch(bootstrapSession());
  }, [dispatch]);

  let content;
  if (phase === 'bootstrapping') {
    content = <PrivacyShield />;
  } else if (phase === 'storageUnavailable') {
    content = <StorageErrorScreen />;
  } else if (phase === 'pinSetupRequired' && setupStep === 'createPin') {
    content = <CreatePinScreen />;
  } else if (phase === 'pinSetupRequired' && setupStep === 'offerBiometrics') {
    content = <BiometricSetupScreen />;
  } else if (
    phase === 'locked' ||
    phase === 'validating' ||
    phase === 'validationUnavailable'
  ) {
    content = <UnlockScreen />;
  } else if (phase === 'unauthenticated') {
    content = (
      <View style={styles.fill} testID="public-navigation">
        <SessionNavigator phase={phase} />
      </View>
    );
  } else if (phase === 'authenticated') {
    content = (
      <View style={styles.fill} testID="protected-navigation">
        <SessionNavigator phase={phase} />
      </View>
    );
  } else {
    content = <PrivacyShield />;
  }

  return (
    <View style={styles.fill}>
      {content}
      {privacyShieldVisible && phase !== 'bootstrapping' ? <PrivacyShield /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
