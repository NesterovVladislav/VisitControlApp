import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSessionLifecycle } from '../../hooks/use-session-lifecycle';
import { useAppDispatch, useAppSelector } from '../../store';
import { bootstrapSession } from '../../store/reducers/auth';
import { AuthPhase } from '../../store/types/auth';
import { BiometricSetupScreen } from './biometric-setup-screen';
import { CreatePinScreen } from './create-pin-screen';
import { PrivacyShield } from './privacy-shield';
import { StorageErrorScreen } from './storage-error-screen';
import { UnlockScreen } from './unlock-screen';

function SessionNavigator({ phase }: { phase: AuthPhase }) {
  const publicRoutes = phase === 'unauthenticated';
  const protectedRoutes = phase === 'authenticated';

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={publicRoutes}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen
          name="register"
          options={{ title: 'Регистрация', headerBackTitle: 'Назад' }}
        />
        <Stack.Screen
          name="registration-sent"
          options={{ gestureEnabled: false, headerShown: false }}
        />
      </Stack.Protected>
      <Stack.Protected guard={protectedRoutes}>
        <Stack.Screen
          name="children"
          options={{
            gestureEnabled: false,
            headerBackVisible: false,
            title: 'Мои дети',
          }}
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
