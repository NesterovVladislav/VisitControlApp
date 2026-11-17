import { AxiosError } from 'axios';
import { runSaga } from 'redux-saga';

import { visitControlApi } from '../../services/api';
import { clearAuthToken, getAuthToken, notifyUnauthorized, setAuthToken, setUnauthorizedHandler } from '../../services/auth/auth-token';
import { protectedSessionRepository } from '../../services/auth/protected-session';
import { ApiError } from '../../services/errors/api-error';
import { PASSWORD_MESSAGES } from '../../utils/password-validation';
import authReducer, { initialAuthState, logoutRequested, userRefreshed } from '../reducers/auth';
import {
  changePasswordFailure,
  changePasswordStart,
  changePasswordSuccess,
  refreshProfileDone,
  saveProfileFailure,
  saveProfileStart,
  saveProfileSuccess,
} from '../reducers/profile';
import { sanitizeReduxAction } from '../devtools';
import {
  PASSWORD_ERRORS,
  SAVE_ERRORS,
  changePasswordSaga,
  refreshProfileSaga,
  saveProfileSaga,
  toChangePasswordFailure,
  toSaveProfileFailure,
} from './profile';

jest.mock('../../services/api', () => ({
  visitControlApi: {
    getMe: jest.fn(),
    changePassword: jest.fn(),
    updateMe: jest.fn(),
  },
}));

jest.mock('../../services/auth/protected-session', () => ({
  protectedSessionRepository: { replaceToken: jest.fn() },
}));

const replaceToken = jest.mocked(protectedSessionRepository.replaceToken);
const mockApi = visitControlApi as jest.Mocked<typeof visitControlApi>;

const user = {
  id: 'user-1',
  email: 'parent@example.com',
  firstName: 'Мария',
  surname: 'Иванова',
  patronymic: 'Петровна',
  birthDate: '1990-03-14',
  phone: '+79123456789',
  gender: 'FEMALE',
  organization: null,
  role: 'PARENT',
} as const;

const passwords = { currentPassword: 'old-password', newPassword: 'new-password' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function run(saga: (...args: any[]) => any, state: { auth: { sessionEpoch: number } }, ...args: unknown[]) {
  const dispatched: { type: string; payload?: unknown }[] = [];
  const task = runSaga(
    { dispatch: (action: { type: string }) => dispatched.push(action), getState: () => state },
    saga,
    ...args,
  );
  return { dispatched, done: task.toPromise() };
}

function badRequest(data: unknown) {
  return new ApiError('Bad Request', 400, 'Bad Request', data as never);
}

describe('profile saga', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuthToken('previous-session');
    replaceToken.mockResolvedValue(true);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    clearAuthToken();
    setUnauthorizedHandler(() => {});
  });

  it('updates the signed-in user after a background refresh', async () => {
    mockApi.getMe.mockResolvedValue(user);
    const { dispatched, done } = run(refreshProfileSaga, { auth: { sessionEpoch: 1 } });
    await done;

    expect(dispatched).toEqual([userRefreshed(user), refreshProfileDone()]);
  });

  it('drops a refresh that finished after the session changed', async () => {
    let resolve: ((value: typeof user) => void) | undefined;
    mockApi.getMe.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const state = { auth: { sessionEpoch: 1 } };
    const { dispatched, done } = run(refreshProfileSaga, state);
    state.auth = { sessionEpoch: 2 };
    resolve?.(user);
    await done;

    expect(dispatched).toEqual([refreshProfileDone()]);
  });

  it('keeps the current data when a refresh fails', async () => {
    mockApi.getMe.mockRejectedValue(new ApiError('Server Error', 500));
    const { dispatched, done } = run(refreshProfileSaga, { auth: { sessionEpoch: 1 } });
    await done;

    expect(dispatched).toEqual([refreshProfileDone()]);
  });

  it('changes the password with the current and the new one', async () => {
    mockApi.changePassword.mockResolvedValue(undefined);
    const { dispatched, done } = run(
      changePasswordSaga, { auth: { sessionEpoch: 1 } }, changePasswordStart(passwords),
    );
    await done;

    expect(mockApi.changePassword).toHaveBeenCalledWith('old-password', 'new-password');
    expect(dispatched).toEqual([changePasswordSuccess()]);
    expect(replaceToken).not.toHaveBeenCalled();
    expect(getAuthToken()).toBe('previous-session');
  });

  it('ignores an old 401 during persistence and installs the replacement token', async () => {
    const unauthorized = jest.fn();
    setUnauthorizedHandler(unauthorized);
    mockApi.changePassword.mockResolvedValue('replacement-session');
    replaceToken.mockImplementationOnce(async () => {
      notifyUnauthorized();
      expect(unauthorized).not.toHaveBeenCalled();
      return true;
    });
    const { done, dispatched } = run(
      changePasswordSaga, { auth: { sessionEpoch: 1 } }, changePasswordStart(passwords),
    );
    await done;
    expect(replaceToken).toHaveBeenCalledWith('previous-session', 'replacement-session');
    expect(dispatched).toEqual([changePasswordSuccess()]);
    expect(getAuthToken()).toBe('replacement-session');
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it('releases a deferred 401 when a legacy response does not replace the token', async () => {
    const unauthorized = jest.fn(() => clearAuthToken());
    setUnauthorizedHandler(unauthorized);
    mockApi.changePassword.mockImplementationOnce(async () => {
      notifyUnauthorized();
      return undefined;
    });
    const { done, dispatched } = run(
      changePasswordSaga, { auth: { sessionEpoch: 1 } }, changePasswordStart(passwords),
    );
    await done;
    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(dispatched).toEqual([]);
    expect(replaceToken).not.toHaveBeenCalled();
  });

  it('asks for a new sign-in when the new token cannot be written', async () => {
    mockApi.changePassword.mockResolvedValue('replacement-session');
    replaceToken.mockRejectedValueOnce(new Error('write failed'));
    const { done, dispatched } = run(
      changePasswordSaga, { auth: { sessionEpoch: 1 } }, changePasswordStart(passwords),
    );
    await done;
    expect(dispatched).toEqual([logoutRequested({ reason: 'passwordChanged' })]);
  });

  it('shows a wrong current password under its field', async () => {
    mockApi.changePassword.mockRejectedValue(badRequest(null));
    const { dispatched, done } = run(
      changePasswordSaga, { auth: { sessionEpoch: 1 } }, changePasswordStart(passwords),
    );
    await done;

    expect(dispatched).toEqual([
      changePasswordFailure({ fieldErrors: { currentPassword: PASSWORD_ERRORS.wrongCurrent } }),
    ]);
  });

  it('drops a password result from a previous session', async () => {
    let resolve: ((token: string) => void) | undefined;
    mockApi.changePassword.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const state = { auth: { sessionEpoch: 1 } };
    const { dispatched, done } = run(changePasswordSaga, state, changePasswordStart(passwords));
    state.auth = { sessionEpoch: 2 };
    setAuthToken('other-account');
    resolve?.('replacement-session');
    await done;

    expect(replaceToken).not.toHaveBeenCalled();
    expect(getAuthToken()).toBe('other-account');
    expect(dispatched).toEqual([]);
  });

  it('hides passwords from Redux DevTools', () => {
    expect(sanitizeReduxAction(changePasswordStart(passwords)).payload).toBe('[REDACTED]');
  });
});

describe('toChangePasswordFailure', () => {
  it('maps server validation of the new password to its field', () => {
    const error = badRequest({ code: 'VALIDATION', errors: { new_password: ['size'] } });
    expect(toChangePasswordFailure(error)).toEqual({ fieldErrors: { newPassword: PASSWORD_MESSAGES.length } });
  });

  it('warns that the password may have changed when the server did not answer', () => {
    const timeout = new ApiError('timeout', null, '', null, new AxiosError('timeout', 'ECONNABORTED'));
    expect(toChangePasswordFailure(timeout)).toEqual({ formError: PASSWORD_ERRORS.noResponse });
  });

  it('shows a generic message for server errors', () => {
    expect(toChangePasswordFailure(new ApiError('Server Error', 500))).toEqual({
      formError: PASSWORD_ERRORS.generic,
    });
  });
});

describe('userRefreshed', () => {
  const signedIn = { ...initialAuthState, phase: 'authenticated' as const, user };

  it('replaces the data of the same user', () => {
    const renamed = { ...user, surname: 'Петрова' };
    expect(authReducer(signedIn, userRefreshed(renamed)).user).toEqual(renamed);
  });

  it('ignores another account and a closed session', () => {
    const other = { ...user, id: 'user-2' };
    expect(authReducer(signedIn, userRefreshed(other)).user).toEqual(user);
    expect(authReducer({ ...signedIn, phase: 'locked', user: null }, userRefreshed(user)).user).toBeNull();
  });
});

describe('saving own profile', () => {
  const update = {
    surname: 'Смирнова',
    first_name: 'Мария',
    patronymic: null,
    birth_date: '1990-03-14',
    phone: '+79123456789',
    gender: 'FEMALE' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('shows the saved data everywhere at once', async () => {
    const saved = { ...user, surname: 'Смирнова' };
    mockApi.updateMe.mockResolvedValue(saved);
    const { dispatched, done } = run(saveProfileSaga, { auth: { sessionEpoch: 1 } }, saveProfileStart(update));
    await done;

    expect(mockApi.updateMe).toHaveBeenCalledWith(update);
    expect(dispatched).toEqual([userRefreshed(saved), saveProfileSuccess()]);
  });

  it('puts a taken phone under the phone field', async () => {
    mockApi.updateMe.mockRejectedValue(new ApiError('Conflict', 409, 'Conflict', { code: 'PHONE_TAKEN' }));
    const { dispatched, done } = run(saveProfileSaga, { auth: { sessionEpoch: 1 } }, saveProfileStart(update));
    await done;

    expect(dispatched).toEqual([saveProfileFailure({ fieldErrors: { phone: SAVE_ERRORS.phoneTaken } })]);
  });

  it('maps server validation, forbidden and network errors', () => {
    expect(toSaveProfileFailure(badRequest({ code: 'VALIDATION', errors: { first_name: ['x'] } })))
      .toEqual({ fieldErrors: { firstName: SAVE_ERRORS.serverRejected } });
    expect(toSaveProfileFailure(new ApiError('Forbidden', 403))).toEqual({ formError: SAVE_ERRORS.forbidden });
    const timeout = new ApiError('timeout', null, '', null, new AxiosError('timeout', 'ECONNABORTED'));
    expect(toSaveProfileFailure(timeout)).toEqual({ formError: SAVE_ERRORS.network });
    expect(toSaveProfileFailure(timeout).formError).toContain('Изменения могли сохраниться');
  });

  it('drops a successful save that finished after switching accounts', async () => {
    let resolve: ((value: typeof user) => void) | undefined;
    mockApi.updateMe.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const state = { auth: { sessionEpoch: 1 } };
    const { dispatched, done } = run(saveProfileSaga, state, saveProfileStart(update));
    state.auth = { sessionEpoch: 2 };
    resolve?.(user);
    await done;
    expect(dispatched).toEqual([]);
  });
});
