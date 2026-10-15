import { runSaga } from 'redux-saga';

import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import {
  changePersonRole,
  changePersonRoleFinished,
  deactivatePerson,
  deactivatePersonFinished,
  loadPeopleFailure,
  loadPeopleSuccess,
  resetPersonPassword,
  resetPersonPasswordFinished,
} from '../reducers/people';
import {
  DEACTIVATION_ERRORS,
  ROLE_CHANGE_ERRORS,
  changeRoleSaga,
  PASSWORD_RESET_ERRORS,
  deactivateSaga,
  loadFirstPageSaga,
  loadMoreSaga,
  resetPasswordSaga,
} from './people';

jest.mock('../../services/api', () => ({
  visitControlApi: { getPeople: jest.fn(), getGroups: jest.fn(), getBranches: jest.fn(), resetPassword: jest.fn(),
    deactivateUser: jest.fn(),
    getAssignableRoles: jest.fn(),
    changeUserRole: jest.fn(),
  },
}));

const mockApi = visitControlApi as jest.Mocked<typeof visitControlApi>;
const query = { category: 'CHILD' as const, q: 'иван', groupFilter: { kind: 'withoutGroup' as const } };
const page = { items: [], page: 0, last: true, total: 0 };

function run(saga: () => Generator, people: Record<string, unknown>, epoch = { value: 1 }) {
  const dispatched: unknown[] = [];
  const task = runSaga(
    {
      dispatch: (action) => dispatched.push(action),
      getState: () => ({ auth: { sessionEpoch: epoch.value }, people: { query, requestId: 7, ...people } }),
    },
    saga,
  );
  return { dispatched, done: task.toPromise() };
}

describe('people saga', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('loads the first page for the current query and tags it with the request', async () => {
    mockApi.getPeople.mockResolvedValue(page);
    const { dispatched, done } = run(loadFirstPageSaga, {});
    await done;
    expect(mockApi.getPeople).toHaveBeenCalledWith(query, 0);
    expect(dispatched).toEqual([loadPeopleSuccess({ requestId: 7, result: page })]);
  });

  it('asks for the next page only when there is one', async () => {
    mockApi.getPeople.mockResolvedValue({ ...page, page: 3 });
    await run(loadMoreSaga, { page: 2, last: false, status: 'loaded' }).done;
    expect(mockApi.getPeople).toHaveBeenCalledWith(query, 3);

    mockApi.getPeople.mockClear();
    await run(loadMoreSaga, { page: 3, last: true, status: 'loaded' }).done;
    expect(mockApi.getPeople).not.toHaveBeenCalled();
  });

  it('reports a failure and drops answers from a previous session', async () => {
    mockApi.getPeople.mockRejectedValue(new Error('network'));
    const failed = run(loadFirstPageSaga, {});
    await failed.done;
    expect(failed.dispatched).toEqual([loadPeopleFailure({ requestId: 7, page: 0 })]);

    let resolve: ((value: typeof page) => void) | undefined;
    mockApi.getPeople.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const epoch = { value: 1 };
    const stale = run(loadFirstPageSaga, {}, epoch);
    epoch.value = 2;
    resolve?.(page);
    await stale.done;
    expect(stale.dispatched).toEqual([]);
  });

  const reset = () => resetPasswordSaga(resetPersonPassword('a'));

  it('reports whether the new password email was sent', async () => {
    mockApi.resetPassword.mockResolvedValue(false);
    const { dispatched, done } = run(reset, {});
    await done;
    expect(mockApi.resetPassword).toHaveBeenCalledWith('a');
    expect(dispatched).toEqual([resetPersonPasswordFinished({ personId: 'a', status: 'notSent', message: null })]);
  });

  it('explains why the password was not reset', async () => {
    mockApi.resetPassword.mockRejectedValue(new ApiError('Forbidden', 403));
    const forbidden = run(reset, {});
    await forbidden.done;
    expect(forbidden.dispatched).toEqual([
      resetPersonPasswordFinished({ personId: 'a', status: 'failed', message: PASSWORD_RESET_ERRORS.forbidden }),
    ]);

    mockApi.resetPassword.mockRejectedValue(new ApiError('Unauthorized', 401));
    const expired = run(reset, {});
    await expired.done;
    expect(expired.dispatched).toEqual([
      resetPersonPasswordFinished({ personId: 'a', status: 'failed', message: null }),
    ]);
  });

  it('deactivates a user and explains a refusal', async () => {
    mockApi.deactivateUser.mockResolvedValue(undefined);
    const done = run(() => deactivateSaga(deactivatePerson('a')), {});
    await done.done;
    expect(mockApi.deactivateUser).toHaveBeenCalledWith('a');
    expect(done.dispatched).toEqual([deactivatePersonFinished({ personId: 'a', status: 'done', message: null })]);

    mockApi.deactivateUser.mockRejectedValue(new ApiError('Conflict', 409));
    const failed = run(() => deactivateSaga(deactivatePerson('a')), {});
    await failed.done;
    expect(failed.dispatched).toEqual([
      deactivatePersonFinished({ personId: 'a', status: 'failed', message: DEACTIVATION_ERRORS.inactive }),
    ]);
  });

  it('assigns the role by its key from the assignable roles', async () => {
    mockApi.getAssignableRoles.mockResolvedValue([{ id: 'r-admin', name: 'ADMIN' }, { id: 'r-emp', name: 'EMPLOYEE' }]);
    mockApi.changeUserRole.mockResolvedValue(undefined);
    const ok = run(() => changeRoleSaga(changePersonRole({ personId: 'ivan', role: 'ADMIN' })), {});
    await ok.done;
    expect(mockApi.changeUserRole).toHaveBeenCalledWith('ivan', 'r-admin');
    expect(ok.dispatched).toEqual([changePersonRoleFinished({ personId: 'ivan', role: 'ADMIN', status: 'done', message: null })]);
  });

  it('refuses when the role cannot be assigned', async () => {
    mockApi.getAssignableRoles.mockResolvedValue([{ id: 'r-emp', name: 'EMPLOYEE' }]);
    const refused = run(() => changeRoleSaga(changePersonRole({ personId: 'ivan', role: 'ADMIN' })), {});
    await refused.done;
    expect(mockApi.changeUserRole).not.toHaveBeenCalled();
    expect(refused.dispatched).toEqual([
      changePersonRoleFinished({ personId: 'ivan', role: 'ADMIN', status: 'failed', message: ROLE_CHANGE_ERRORS.forbidden }),
    ]);
  });
});
