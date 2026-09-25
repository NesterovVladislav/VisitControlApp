import { AxiosError } from 'axios';
import { runSaga, stdChannel } from 'redux-saga';

jest.mock('../../services/auth/protected-session', () => ({
  protectedSessionRepository: {
    load: jest.fn(),
    beginSession: jest.fn(),
    completePinSetup: jest.fn(),
    verifyPin: jest.fn(),
    resetFailedPinAttempts: jest.fn(),
    setBiometricsEnabled: jest.fn(),
    clear: jest.fn(),
  },
}));
jest.mock('../../services/auth/install-marker', () => ({
  ensureCurrentInstallation: jest.fn(),
}));
jest.mock('../../services/auth/biometrics', () => ({
  getBiometricCapability: jest.fn(),
  promptForBiometricUnlock: jest.fn(),
}));
jest.mock('../../services/api', () => ({
  visitControlApi: { login: jest.fn(), getMe: jest.fn() },
}));

import { visitControlApi } from '../../services/api';
import {
  getBiometricCapability,
  promptForBiometricUnlock,
} from '../../services/auth/biometrics';
import { ensureCurrentInstallation } from '../../services/auth/install-marker';
import { protectedSessionRepository } from '../../services/auth/protected-session';

const mockRepository = protectedSessionRepository as jest.Mocked<typeof protectedSessionRepository>;
const mockEnsureCurrentInstallation = ensureCurrentInstallation as jest.MockedFunction<typeof ensureCurrentInstallation>;
const mockGetBiometricCapability = getBiometricCapability as jest.MockedFunction<typeof getBiometricCapability>;
const mockPromptForBiometricUnlock = promptForBiometricUnlock as jest.MockedFunction<typeof promptForBiometricUnlock>;
const mockApi = visitControlApi as jest.Mocked<typeof visitControlApi>;

import { clearAuthToken, getAuthToken } from '../../services/auth/auth-token';
import { loadChildrenStart } from '../reducers/children';
import { ApiError } from '../../services/errors/api-error';
import {
  bootstrapLocked,
  bootstrapPinSetupRequired,
  bootstrapUnauthenticated,
  completePinSetup,
  loginStart,
  logoutCompleted,
  logoutRequested,
  pinSetupCompleted,
  sessionExpired,
  sessionValidationUnavailable,
  storageUnavailable,
  submitBiometricPreference,
  unlockFailed,
  unlockWithBiometrics,
  unlockWithPin,
  validationSucceeded,
} from '../reducers/auth';
import {
  AUTH_ERRORS,
  bootstrapSessionSaga,
  cleanupSessionSaga,
  completePinSetupSaga,
  loginSaga,
  resetAuthSagaStateForTests,
  retryProtectedStorageSaga,
  retrySessionValidationSaga,
  submitBiometricPreferenceSaga,
  unlockWithBiometricsSaga,
  unlockWithPinSaga,
  watchLogin,
} from './auth';

const readyRecord = {
  version: 1 as const,
  token: 'saved-jwt',
  status: 'ready' as const,
  pinSalt: 'ab'.repeat(16),
  pinVerifier: '1'.repeat(64),
  failedPinAttempts: 0,
  biometricsEnabled: true,
};
const incompleteRecord = {
  version: 1 as const,
  token: 'saved-jwt',
  status: 'pin_setup_required' as const,
  pinSalt: null,
  pinVerifier: null,
  failedPinAttempts: 0,
  biometricsEnabled: false,
};
const user = {
  id: 'user-1',
  email: 'parent@example.com',
  firstName: 'Parent',
  surname: 'Example',
  patronymic: null,
  gender: null,
  role: 'PARENT',
};

async function runWorker(saga: (...args: any[]) => Generator, ...args: any[]) {
  const dispatched: unknown[] = [];
  const state = { auth: { sessionEpoch: 1 } };
  await runSaga(
    {
      dispatch: (action) => dispatched.push(action),
      getState: () => state,
    },
    saga,
    ...args,
  ).toPromise();
  return dispatched;
}

function networkError() {
  return new ApiError(
    'network',
    null,
    '',
    null,
    new AxiosError('network', 'ERR_NETWORK'),
  );
}

describe('auth sagas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAuthToken();
    resetAuthSagaStateForTests();
    mockEnsureCurrentInstallation.mockResolvedValue(undefined);
    mockRepository.load.mockResolvedValue(null);
    mockRepository.beginSession.mockResolvedValue(incompleteRecord);
    mockRepository.completePinSetup.mockResolvedValue(readyRecord);
    mockRepository.verifyPin.mockResolvedValue({ kind: 'success', record: readyRecord });
    mockRepository.resetFailedPinAttempts.mockResolvedValue(readyRecord);
    mockRepository.setBiometricsEnabled.mockResolvedValue(readyRecord);
    mockRepository.clear.mockResolvedValue(undefined);
    mockGetBiometricCapability.mockResolvedValue({ available: true, types: [1] });
    mockPromptForBiometricUnlock.mockResolvedValue({ kind: 'success' });
    mockApi.login.mockResolvedValue('new-jwt');
    mockApi.getMe.mockResolvedValue(user);
  });

  it('resumes PIN setup when a token was saved before process death', async () => {
    mockRepository.load.mockResolvedValue(incompleteRecord);
    const dispatched = await runWorker(bootstrapSessionSaga);
    expect(mockEnsureCurrentInstallation).toHaveBeenCalledTimes(1);
    expect(dispatched).toContainEqual(bootstrapPinSetupRequired());
    expect(getAuthToken()).toBeNull();
  });

  it('restores a complete session in the locked phase', async () => {
    mockRepository.load.mockResolvedValue({ ...readyRecord, failedPinAttempts: 2 });
    const dispatched = await runWorker(bootstrapSessionSaga);
    expect(dispatched).toContainEqual(bootstrapLocked({
      biometricsEnabled: true,
      remainingPinAttempts: 3,
    }));
    expect(mockApi.getMe).not.toHaveBeenCalled();
    expect(getAuthToken()).toBeNull();
  });

  it('opens public login when there is no saved session', async () => {
    const dispatched = await runWorker(bootstrapSessionSaga);
    expect(dispatched).toContainEqual(bootstrapUnauthenticated());
  });

  it.each([
    ['installation marker', () => mockEnsureCurrentInstallation.mockRejectedValue(new Error('marker'))],
    ['SecureStore load', () => mockRepository.load.mockRejectedValue(new Error('read'))],
  ])('fails closed when %s fails', async (_label, arrange) => {
    arrange();
    const dispatched = await runWorker(bootstrapSessionSaga);
    expect(getAuthToken()).toBeNull();
    expect(dispatched).toContainEqual(storageUnavailable(AUTH_ERRORS.storage));
    expect(dispatched).not.toContainEqual(expect.objectContaining({ type: bootstrapLocked.type }));
  });

  it('persists login before opening PIN setup', async () => {
    const action = loginStart({ email: 'parent@example.com', password: 'secret' });
    const dispatched = await runWorker(loginSaga, action);
    expect(mockApi.login).toHaveBeenCalledWith(action.payload);
    expect(getAuthToken()).toBe('new-jwt');
    expect(mockRepository.beginSession).toHaveBeenCalledWith('new-jwt');
    expect(dispatched).toContainEqual(bootstrapPinSetupRequired());
    expect(mockApi.getMe).not.toHaveBeenCalled();
  });

it('does not run two credential logins concurrently', async () => {
  let finishLogin: ((token: string) => void) | undefined;
  mockApi.login.mockImplementationOnce(
    () => new Promise<string>((resolve) => { finishLogin = resolve; }),
  );
  const channel = stdChannel();
  const task = runSaga(
    {
      channel,
      dispatch: jest.fn(),
      getState: () => ({ auth: { sessionEpoch: 1 } }),
    },
    watchLogin,
  );

  channel.put(loginStart({ email: 'first@example.invalid', password: '' }));
  await Promise.resolve();
  channel.put(loginStart({ email: 'second@example.invalid', password: '' }));
  await Promise.resolve();

  expect(mockApi.login).toHaveBeenCalledTimes(1);
  finishLogin?.('synthetic-token');
  await Promise.resolve();
  task.cancel();
  await task.toPromise();
});

it('clears an in-memory token when persistence after login fails', async () => {
    mockRepository.beginSession.mockRejectedValue(new Error('write'));
    const dispatched = await runWorker(
      loginSaga,
      loginStart({ email: 'parent@example.com', password: 'secret' }),
    );
    expect(getAuthToken()).toBeNull();
    expect(dispatched).toContainEqual(storageUnavailable(AUTH_ERRORS.storage));
  });

  it('turns wrong credentials into a public login error', async () => {
    mockApi.login.mockRejectedValue(new ApiError('unauthorized', 401));
    const dispatched = await runWorker(
      loginSaga,
      loginStart({ email: 'parent@example.com', password: 'wrong' }),
    );
    expect(dispatched).toContainEqual(expect.objectContaining({
      type: 'auth/loginFailure',
      payload: AUTH_ERRORS.wrongCredentials,
    }));
  });

  it('completes PIN setup and offers biometrics when available', async () => {
    const dispatched = await runWorker(
      completePinSetupSaga,
      completePinSetup({ pin: '1234' }),
    );
    expect(mockRepository.completePinSetup).toHaveBeenCalledWith('1234');
    expect(dispatched).toContainEqual(pinSetupCompleted({ biometricsAvailable: true }));
  });

  it('fails closed if PIN setup persistence fails', async () => {
    mockRepository.completePinSetup.mockRejectedValue(new Error('write'));
    const dispatched = await runWorker(
      completePinSetupSaga,
      completePinSetup({ pin: '1234' }),
    );
    expect(getAuthToken()).toBeNull();
    expect(dispatched).toContainEqual(storageUnavailable(AUTH_ERRORS.storage));
  });

  it('validates the saved token after biometric preference is persisted', async () => {
    const dispatched = await runWorker(
      submitBiometricPreferenceSaga,
      submitBiometricPreference({ enabled: true }),
    );
    expect(mockRepository.setBiometricsEnabled).toHaveBeenCalledWith(true);
    expect(getAuthToken()).toBe('saved-jwt');
    expect(dispatched).toContainEqual(validationSucceeded(user));
  });

  it('does not report validation failure after a successful backend response', async () => {
    const dispatched = await runWorker(unlockWithPinSaga, unlockWithPin({ pin: '1234' }));
    expect(dispatched).toContainEqual(validationSucceeded(user));
    expect(dispatched).not.toContainEqual(
      expect.objectContaining({ type: sessionValidationUnavailable.type }),
    );
  });

  it('loads an administrator children after validating the backend session', async () => {
    const admin = { ...user, role: 'ADMIN' };
    mockApi.getMe.mockResolvedValue(admin);
    const dispatched = await runWorker(unlockWithPinSaga, unlockWithPin({ pin: '1234' }));
    expect(dispatched).toContainEqual(validationSucceeded(admin));
    expect(dispatched).toContainEqual(loadChildrenStart());
    expect(dispatched).not.toContainEqual(
      expect.objectContaining({ type: sessionValidationUnavailable.type }),
    );
  });

  it('unlocks with a correct PIN and validates the backend session', async () => {
    const dispatched = await runWorker(unlockWithPinSaga, unlockWithPin({ pin: '1234' }));
    expect(mockRepository.verifyPin).toHaveBeenCalledWith('1234');
    expect(getAuthToken()).toBe('saved-jwt');
    expect(dispatched).toContainEqual(validationSucceeded(user));
  });

  it('keeps the lock and persisted attempt count after a wrong PIN', async () => {
    mockRepository.verifyPin.mockResolvedValue({ kind: 'failure', remainingAttempts: 3 });
    const dispatched = await runWorker(unlockWithPinSaga, unlockWithPin({ pin: '9999' }));
    expect(dispatched).toContainEqual(unlockFailed({
      error: AUTH_ERRORS.wrongPin,
      remainingAttempts: 3,
    }));
    expect(mockApi.getMe).not.toHaveBeenCalled();
  });

  it('falls back to full sign-in after the fifth wrong PIN', async () => {
    mockRepository.verifyPin.mockResolvedValue({ kind: 'sessionCleared' });
    const dispatched = await runWorker(unlockWithPinSaga, unlockWithPin({ pin: '9999' }));
    expect(getAuthToken()).toBeNull();
    expect(dispatched).toContainEqual(logoutCompleted({
      reason: 'expired',
      notice: AUTH_ERRORS.tooManyPinAttempts,
    }));
  });

  it.each([
    [{ kind: 'unavailable' } as const, AUTH_ERRORS.biometricsUnavailable],
    [{ kind: 'cancelled' } as const, null],
    [{ kind: 'lockedOut' } as const, AUTH_ERRORS.biometricsLockedOut],
    [{ kind: 'failed' } as const, AUTH_ERRORS.biometricsFailed],
  ])('keeps PIN available after biometric result %#', async (result, error) => {
    mockPromptForBiometricUnlock.mockResolvedValue(result);
    const dispatched = await runWorker(unlockWithBiometricsSaga, unlockWithBiometrics());
    expect(dispatched).toContainEqual(unlockFailed({ error }));
    expect(mockRepository.verifyPin).not.toHaveBeenCalled();
  });

  it('resets failed PIN attempts after biometric success', async () => {
    const dispatched = await runWorker(unlockWithBiometricsSaga, unlockWithBiometrics());
    expect(mockRepository.resetFailedPinAttempts).toHaveBeenCalledTimes(1);
    expect(dispatched).toContainEqual(validationSucceeded(user));
  });

  it.each([
    ['network', networkError()],
    ['server', new ApiError('server', 503)],
  ])('keeps the protected record on %s validation failure', async (_label, error) => {
    mockApi.getMe.mockRejectedValue(error);
    const dispatched = await runWorker(unlockWithPinSaga, unlockWithPin({ pin: '1234' }));
    expect(mockRepository.clear).not.toHaveBeenCalled();
    expect(dispatched).toContainEqual(sessionValidationUnavailable(AUTH_ERRORS.validationUnavailable));
  });

  it('expires an authenticated backend session on 401', async () => {
    mockApi.getMe.mockRejectedValue(new ApiError('expired', 401));
    const dispatched = await runWorker(unlockWithPinSaga, unlockWithPin({ pin: '1234' }));
    expect(dispatched).toContainEqual(sessionExpired());
    expect(dispatched).not.toContainEqual(expect.objectContaining({
      type: sessionValidationUnavailable.type,
    }));
  });

  it('retries backend validation without clearing the saved session', async () => {
    mockRepository.load.mockResolvedValue(readyRecord);
    const dispatched = await runWorker(retrySessionValidationSaga);
    expect(mockRepository.load).toHaveBeenCalledTimes(1);
    expect(dispatched).toContainEqual(validationSucceeded(user));
    expect(mockRepository.clear).not.toHaveBeenCalled();
  });

  it('retrying protected storage reruns bootstrap without credentials', async () => {
    mockRepository.load.mockResolvedValue(readyRecord);
    const dispatched = await runWorker(retryProtectedStorageSaga);
    expect(mockApi.login).not.toHaveBeenCalled();
    expect(dispatched).toContainEqual(bootstrapLocked({
      biometricsEnabled: true,
      remainingPinAttempts: 5,
    }));
  });

  it('clears persistent and in-memory state on explicit logout', async () => {
    const dispatched = await runWorker(
      cleanupSessionSaga,
      logoutRequested({ reason: 'user' }),
    );
    expect(getAuthToken()).toBeNull();
    expect(mockRepository.clear).toHaveBeenCalledTimes(1);
    expect(dispatched).toContainEqual(logoutCompleted({ reason: 'user' }));
  });

  it('coalesces concurrent expiry cleanup', async () => {
    let finishClear: (() => void) | undefined;
    mockRepository.clear.mockImplementation(() => new Promise<void>((resolve) => {
      finishClear = resolve;
    }));
    const first = runWorker(cleanupSessionSaga, sessionExpired());
    const second = runWorker(cleanupSessionSaga, sessionExpired());
    await Promise.resolve();
    expect(mockRepository.clear).toHaveBeenCalledTimes(1);
    finishClear?.();
    const [firstActions, secondActions] = await Promise.all([first, second]);
    expect([...firstActions, ...secondActions]).toContainEqual(logoutCompleted({
      reason: 'expired',
      notice: AUTH_ERRORS.expired,
    }));
  });
});
