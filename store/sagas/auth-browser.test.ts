/**
 * Сага входа в браузере (docs/pwa-ios.md, «Защита сессии»): PIN нет, Face ID — по желанию.
 * Тесты запускаются в окружении телефона, поэтому браузерная политика подставляется моком.
 */
import { runSaga } from 'redux-saga';

jest.mock('../../services/auth/session-policy', () => ({ usesPinLock: false }));
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
import { BiometricEnrollmentError } from '../../services/auth/biometric-enrollment-error';
import {
  getBiometricCapability,
  promptForBiometricUnlock,
} from '../../services/auth/biometrics';
import { clearAuthToken, getAuthToken } from '../../services/auth/auth-token';
import { protectedSessionRepository } from '../../services/auth/protected-session';
import {
  biometricEnrollmentFailed,
  biometricOfferRequired,
  bootstrapPinSetupRequired,
  loginStart,
  submitBiometricPreference,
  unlockFailed,
  validationSucceeded,
} from '../reducers/auth';
import {
  AUTH_ERRORS,
  loginSaga,
  resetAuthSagaStateForTests,
  submitBiometricPreferenceSaga,
  unlockWithBiometricsSaga,
} from './auth';

const mockRepository = protectedSessionRepository as jest.Mocked<typeof protectedSessionRepository>;
const mockGetBiometricCapability = getBiometricCapability as jest.MockedFunction<typeof getBiometricCapability>;
const mockPromptForBiometricUnlock = promptForBiometricUnlock as jest.MockedFunction<typeof promptForBiometricUnlock>;
const mockApi = visitControlApi as jest.Mocked<typeof visitControlApi>;

const webRecord = {
  version: 1 as const,
  token: 'web-jwt',
  status: 'ready' as const,
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
  birthDate: null,
  phone: null,
  gender: null,
  organization: null,
  role: 'PARENT',
};
const credentials = { email: 'parent@example.com', password: 'secret' };

async function runWorker(saga: (...args: any[]) => Generator, ...args: any[]) {
  const dispatched: { type: string; payload?: unknown }[] = [];
  const state = { auth: { sessionEpoch: 1 } };
  await runSaga(
    {
      dispatch: (action: { type: string; payload?: unknown }) => dispatched.push(action),
      getState: () => state,
    },
    saga,
    ...args,
  ).toPromise();
  return dispatched;
}

describe('auth sagas in the browser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAuthToken();
    resetAuthSagaStateForTests();
    mockApi.login.mockResolvedValue('web-jwt');
    mockApi.getMe.mockResolvedValue(user);
    mockRepository.beginSession.mockResolvedValue(webRecord);
  });

  it('offers Face ID right after login instead of PIN setup', async () => {
    mockGetBiometricCapability.mockResolvedValue({ available: true, types: [] as never });

    const dispatched = await runWorker(loginSaga, loginStart(credentials));

    expect(mockRepository.beginSession).toHaveBeenCalledWith('web-jwt');
    expect(dispatched).toEqual([biometricOfferRequired()]);
    expect(dispatched).not.toContainEqual(bootstrapPinSetupRequired());
    expect(mockApi.getMe).not.toHaveBeenCalled();
  });

  it('opens the app straight away when Face ID is not available', async () => {
    mockGetBiometricCapability.mockResolvedValue({ available: false, reason: 'unsupported', types: [] });

    const dispatched = await runWorker(loginSaga, loginStart(credentials));

    expect(getAuthToken()).toBe('web-jwt');
    expect(dispatched).toContainEqual(validationSucceeded(user));
    expect(dispatched).not.toContainEqual(bootstrapPinSetupRequired());
  });

  it('stays on the offer with an explanation when Face ID could not be enabled', async () => {
    mockRepository.setBiometricsEnabled.mockRejectedValue(new BiometricEnrollmentError('confirmationRequired'));

    const dispatched = await runWorker(
      submitBiometricPreferenceSaga,
      submitBiometricPreference({ enabled: true }),
    );

    expect(dispatched).toEqual([biometricEnrollmentFailed(AUTH_ERRORS.webEnrollmentConfirm)]);
    expect(mockApi.getMe).not.toHaveBeenCalled();
  });

  it('shows no error when the user closes the Face ID prompt during setup', async () => {
    mockRepository.setBiometricsEnabled.mockRejectedValue(new BiometricEnrollmentError('cancelled'));

    const dispatched = await runWorker(
      submitBiometricPreferenceSaga,
      submitBiometricPreference({ enabled: true }),
    );

    expect(dispatched).toEqual([biometricEnrollmentFailed(null)]);
  });

  it('validates the session once Face ID is enabled', async () => {
    mockRepository.setBiometricsEnabled.mockResolvedValue({ ...webRecord, biometricsEnabled: true });

    const dispatched = await runWorker(
      submitBiometricPreferenceSaga,
      submitBiometricPreference({ enabled: true }),
    );

    expect(dispatched).toContainEqual(validationSucceeded(user));
  });

  it('points to password login, not PIN, when Face ID unlock fails', async () => {
    mockPromptForBiometricUnlock.mockResolvedValue({ kind: 'failed' });

    const dispatched = await runWorker(unlockWithBiometricsSaga);

    expect(dispatched).toEqual([unlockFailed({ error: AUTH_ERRORS.webBiometricsFailed })]);
  });

  it('unlocks with the decrypted token after Face ID', async () => {
    mockPromptForBiometricUnlock.mockResolvedValue({ kind: 'success' });
    mockRepository.resetFailedPinAttempts.mockResolvedValue({ ...webRecord, biometricsEnabled: true });

    const dispatched = await runWorker(unlockWithBiometricsSaga);

    expect(getAuthToken()).toBe('web-jwt');
    expect(dispatched).toContainEqual(validationSucceeded(user));
  });
});
