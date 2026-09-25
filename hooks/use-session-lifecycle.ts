import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import {
  disableProtectedScreenPrivacy,
  enableProtectedScreenPrivacy,
} from '../services/auth/screen-privacy';
import {
  SessionTimestamp,
  shouldLockAfterBackground,
} from '../services/auth/session-lock';
import { useAppDispatch } from '../store';
import { lockSession } from '../store/reducers/auth';
import { AuthPhase } from '../store/types/auth';

const currentTimestamp = (): SessionTimestamp => ({
  monotonicMs: performance.now(),
  wallClockMs: Date.now(),
});

const tracksBackgroundTimeout = (phase: AuthPhase): boolean =>
  phase === 'authenticated' ||
  phase === 'validating' ||
  phase === 'validationUnavailable';

export function useSessionLifecycle(phase: AuthPhase): {
  privacyShieldVisible: boolean;
} {
  const dispatch = useAppDispatch();
  const phaseRef = useRef(phase);
  const backgroundStartedAt = useRef<SessionTimestamp | null>(null);
  const [appIsInactive, setAppIsInactive] = useState(
    AppState.currentState !== 'active',
  );
  const [nativePrivacyFailed, setNativePrivacyFailed] = useState(false);

  phaseRef.current = phase;

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
        if (backgroundStartedAt.current === null) {
          backgroundStartedAt.current = currentTimestamp();
        }
        return;
      }

      const startedAt = backgroundStartedAt.current;
      backgroundStartedAt.current = null;
      if (
        tracksBackgroundTimeout(phaseRef.current) &&
        shouldLockAfterBackground(startedAt, currentTimestamp())
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
