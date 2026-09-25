import reducer, {
  bootstrapLocked,
  bootstrapPinSetupRequired,
  bootstrapSession,
  bootstrapUnauthenticated,
  completePinSetup,
  initialAuthState,
  lockSession,
  loginFailure,
  loginStart,
  logoutCompleted,
  logoutRequested,
  pinSetupCompleted,
  sessionExpired,
  sessionValidationUnavailable,
  storageUnavailable,
  submitBiometricPreference,
  unlockWithBiometrics,
  unlockWithPin,
  validationStarted,
  validationSucceeded,
} from './auth';
import { sanitizeReduxAction, sanitizeReduxState } from '../devtools';

const user = {
  id: 'user-1',
  email: 'parent@example.com',
  firstName: 'Parent',
  surname: 'Example',
  patronymic: null,
  gender: null,
  role: 'PARENT',
} as const;

describe('auth reducer state machine', () => {
  it('bootstraps to unauthenticated, incomplete setup, or locked phases', () => {
    const started = reducer(initialAuthState, bootstrapSession());
    expect(started).toMatchObject({ phase: 'bootstrapping', isLoading: true });

    const unauthenticated = reducer(started, bootstrapUnauthenticated({ notice: 'Войдите снова' }));
    expect(unauthenticated).toMatchObject({
      phase: 'unauthenticated',
      notice: 'Войдите снова',
      user: null,
      setupStep: null,
    });

    const pinSetup = reducer(initialAuthState, bootstrapPinSetupRequired());
    expect(pinSetup).toMatchObject({
      phase: 'pinSetupRequired',
      setupStep: 'createPin',
      sessionEpoch: 1,
    });

    const locked = reducer(initialAuthState, bootstrapLocked({
      biometricsEnabled: true,
      remainingPinAttempts: 3,
    }));
    expect(locked).toMatchObject({
      phase: 'locked',
      biometricsEnabled: true,
      remainingPinAttempts: 3,
      sessionEpoch: 1,
    });
  });

  it('moves login through PIN setup and biometric offer without secrets in state', () => {
    const credentials = { email: 'parent@example.com', password: 'super-secret' };
    const loggingIn = reducer(
      { ...initialAuthState, phase: 'unauthenticated', isLoading: false },
      loginStart(credentials),
    );
    expect(loggingIn).toMatchObject({ phase: 'unauthenticated', isLoading: true, error: null });

    const pinSetup = reducer(loggingIn, bootstrapPinSetupRequired());
    const completing = reducer(pinSetup, completePinSetup({ pin: '1234' }));
    const offer = reducer(completing, pinSetupCompleted({ biometricsAvailable: true }));

    expect(offer).toMatchObject({
      phase: 'pinSetupRequired',
      setupStep: 'offerBiometrics',
      biometricsAvailable: true,
      isLoading: false,
    });
    expect(JSON.stringify(offer)).not.toContain('super-secret');
    expect(JSON.stringify(offer)).not.toContain('1234');
    expect(offer).not.toHaveProperty('token');
    expect(offer).not.toHaveProperty('password');
  });

  it('handles lock, validation success, and retryable validation failure', () => {
    const authenticated = reducer(
      { ...initialAuthState, phase: 'validating', isLoading: true, sessionEpoch: 3 },
      validationSucceeded(user),
    );
    expect(authenticated).toMatchObject({ phase: 'authenticated', user, isLoading: false });

    const locked = reducer(authenticated, lockSession());
    expect(locked).toMatchObject({ phase: 'locked', user: null, isLoading: false });

    const validating = reducer(
      { ...locked, remainingPinAttempts: 2 },
      validationStarted(),
    );
    expect(validating).toMatchObject({
      phase: 'validating',
      isLoading: true,
      remainingPinAttempts: 5,
    });

    const unavailable = reducer(validating, sessionValidationUnavailable('Нет сети'));
    expect(unavailable).toMatchObject({
      phase: 'validationUnavailable',
      error: 'Нет сети',
      user: null,
      isLoading: false,
    });
  });

it('locks an in-flight validation and invalidates its result', () => {
  const validating = {
    ...initialAuthState,
    phase: 'validating' as const,
    isLoading: true,
    sessionEpoch: 4,
  };

  expect(reducer(validating, lockSession())).toMatchObject({
    phase: 'locked',
    isLoading: false,
    sessionEpoch: 5,
  });
});

it('keeps protected phases closed while commands are in progress', () => {
    const locked = { ...initialAuthState, phase: 'locked' as const, isLoading: false };
    expect(reducer(locked, unlockWithPin({ pin: '1234' }))).toMatchObject({
      phase: 'locked',
      isLoading: true,
    });
    expect(reducer(locked, unlockWithBiometrics())).toMatchObject({
      phase: 'locked',
      isLoading: true,
    });

    const setup = {
      ...initialAuthState,
      phase: 'pinSetupRequired' as const,
      setupStep: 'offerBiometrics' as const,
      isLoading: false,
    };
    expect(reducer(setup, submitBiometricPreference({ enabled: true }))).toMatchObject({
      phase: 'pinSetupRequired',
      isLoading: true,
    });
  });

  it('keeps the current route closed until cleanup completes', () => {
    const authenticated = {
      ...initialAuthState,
      phase: 'authenticated' as const,
      isLoading: false,
      user,
      sessionEpoch: 7,
    };
    const requested = reducer(authenticated, logoutRequested({ reason: 'user' }));
    expect(requested).toMatchObject({ phase: 'authenticated', isLoading: true, sessionEpoch: 7 });

    const completed = reducer(requested, logoutCompleted({ reason: 'user' }));
    expect(completed).toMatchObject({
      phase: 'unauthenticated',
      isLoading: false,
      user: null,
      sessionEpoch: 8,
    });
  });

  it('shows an expiry notice only after cleanup completes', () => {
    const locked = {
      ...initialAuthState,
      phase: 'locked' as const,
      sessionEpoch: 2,
    };
    const expiring = reducer(locked, sessionExpired());
    expect(expiring.phase).toBe('locked');

    const completed = reducer(
      expiring,
      logoutCompleted({ reason: 'expired', notice: 'Сессия истекла. Войдите снова' }),
    );
    expect(completed).toMatchObject({
      phase: 'unauthenticated',
      notice: 'Сессия истекла. Войдите снова',
      sessionEpoch: 3,
    });
  });

  it('fails closed when protected storage is unavailable', () => {
    const state = reducer(initialAuthState, storageUnavailable('Хранилище недоступно'));
    expect(state).toMatchObject({
      phase: 'storageUnavailable',
      error: 'Хранилище недоступно',
      user: null,
      isLoading: false,
    });
  });

  it('returns login errors to the public route', () => {
    const state = reducer(
      { ...initialAuthState, phase: 'unauthenticated', isLoading: true },
      loginFailure('Неверный email или пароль'),
    );
    expect(state).toMatchObject({
      phase: 'unauthenticated',
      isLoading: false,
      error: 'Неверный email или пароль',
    });
  });
});

describe('Redux DevTools sanitizers', () => {
  it('redacts every credential-bearing auth command', () => {
    for (const action of [
      loginStart({ email: 'parent@example.com', password: 'secret' }),
      completePinSetup({ pin: '1234' }),
      unlockWithPin({ pin: '1234' }),
    ]) {
      expect(sanitizeReduxAction(action)).toEqual({
        type: action.type,
        payload: '[REDACTED]',
      });
    }
  });

  it('redacts sensitive state keys recursively', () => {
    const sanitized = sanitizeReduxState({
      auth: { phase: 'locked', token: 'jwt' },
      form: { password: 'secret', nested: { pinVerifier: 'hash' } },
    });
    expect(JSON.stringify(sanitized)).not.toContain('jwt');
    expect(JSON.stringify(sanitized)).not.toContain('secret');
    expect(JSON.stringify(sanitized)).not.toContain('hash');
  });
});

describe('late session expiry', () => {
  it('does not reopen cleanup after the user is already signed out', () => {
    const unauthenticated = {
      ...initialAuthState,
      phase: 'unauthenticated' as const,
      isLoading: false,
      sessionEpoch: 4,
    };
    expect(reducer(unauthenticated, sessionExpired())).toEqual(unauthenticated);
  });
});
