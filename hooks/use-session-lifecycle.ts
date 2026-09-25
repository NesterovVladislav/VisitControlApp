import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import {
  disableProtectedScreenPrivacy,
  enableProtectedScreenPrivacy,
} from '../services/auth/screen-privacy';
import { shouldLockAfterBackground } from '../services/auth/session-lock';
import { useAppDispatch } from '../store';
import { lockSession } from '../store/reducers/auth';
import { AuthPhase } from '../store/types/auth';

const monotonicNow = () => performance.now();

export function useSessionLifecycle(phase: AuthPhase): {
  privacyShieldVisible: boolean;
} {
  const dispatch = useAppDispatch();
  const phaseRef = useRef(phase);
  const backgroundStartedAt = useRef<number | null>(null);
  const [appIsInactive, setAppIsInactive] = useState(
    AppState.currentState !== 'active',
  );
  const [nativePrivacyFailed, setNativePrivacyFailed] = useState(false);

  phaseRef.current = phase;

  useEffect(() => {
    if (phase !== 'authenticated') {
      backgroundStartedAt.current = null;
    }
  }, [phase]);

  useEffect(() => {
    let active = true;
    const protectedPhase = phase !== 'unauthenticated';

    if (protectedPhase) {
      void enableProtectedScreenPrivacy().then((enabled) => {
        if (active) setNativePrivacyFailed(!enabled);
      });
    } else {
      void disableProtectedScreenPrivacy().then(() => {
        if (active) setNativePrivacyFailed(false);
      });
    }

    return () => {
      active = false;
    };
  }, [phase]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        setAppIsInactive(true);
        if (
          phaseRef.current === 'authenticated' &&
          backgroundStartedAt.current === null
        ) {
          backgroundStartedAt.current = monotonicNow();
        }
        return;
      }

      const startedAt = backgroundStartedAt.current;
      backgroundStartedAt.current = null;
      if (
        phaseRef.current === 'authenticated' &&
        shouldLockAfterBackground(startedAt, monotonicNow())
      ) {
        dispatch(lockSession());
      }
      setAppIsInactive(false);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [dispatch]);

  return {
    privacyShieldVisible: appIsInactive || nativePrivacyFailed,
  };
}
