import { runSaga, stdChannel } from 'redux-saga';

jest.mock('../../services/api', () => ({
  visitControlApi: {
    getRegistrationRequests: jest.fn(),
    approveRegistration: jest.fn(),
    rejectRegistration: jest.fn(),
    resetPassword: jest.fn(),
    getPresence: jest.fn(),
    getVisits: jest.fn(),
  },
}));

import { visitControlApi } from '../../services/api';
import {
  approveRequest,
  approveSuccess,
  loadRequestsFailure,
  loadRequestsStart,
  loadRequestsSuccess,
  rejectRequest,
  rejectSuccess,
  resendPassword,
  resendPasswordSuccess,
} from '../reducers/requests';
import {
  loadJournalFailure,
  loadJournalStart,
  loadJournalSuccess,
  loadPresentStart,
  loadPresentSuccess,
} from '../reducers/visits';
import { watchRequests } from './requests';
import { watchVisits } from './visits';

const api = visitControlApi as jest.Mocked<typeof visitControlApi>;
const request = {
  id: 'request-1',
  surname: 'Иванова',
  firstName: 'Анна',
  patronymic: null,
  birthDate: null,
  gender: null,
  email: 'anna@example.invalid',
  phone: '+70000000000',
  created: '2026-09-25T08:00:00.000Z',
} as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function startWatcher(watcher: typeof watchRequests | typeof watchVisits) {
  const state = {
    auth: { sessionEpoch: 1 },
    visits: { journal: { page: 0, last: false, status: 'loaded' } },
  };
  const dispatched: unknown[] = [];
  const channel = stdChannel();
  const task = runSaga({
    channel,
    getState: () => state,
    dispatch: (action) => dispatched.push(action),
  }, watcher);
  return { state, dispatched, channel, task };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('admin saga session isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not publish pending requests fetched for a previous session', async () => {
    const pending = deferred<{ items: typeof request[]; total: number }>();
    api.getRegistrationRequests.mockReturnValue(pending.promise);
    const run = startWatcher(watchRequests);
    run.channel.put(loadRequestsStart());
    expect(api.getRegistrationRequests).toHaveBeenCalledTimes(1);

    run.state.auth.sessionEpoch = 2;
    pending.resolve({ items: [request], total: 1 });
    await settle();

    expect(run.dispatched).not.toContainEqual(expect.objectContaining({ type: loadRequestsSuccess.type }));
    run.task.cancel();
    await run.task.toPromise();
  });

  it('does not publish a previous session request failure', async () => {
    const pending = deferred<{ items: typeof request[]; total: number }>();
    api.getRegistrationRequests.mockReturnValue(pending.promise);
    const run = startWatcher(watchRequests);
    run.channel.put(loadRequestsStart());

    run.state.auth.sessionEpoch = 2;
    pending.reject(new Error('old request failed'));
    await settle();

    expect(run.dispatched).not.toContainEqual(expect.objectContaining({ type: loadRequestsFailure.type }));
    run.task.cancel();
    await run.task.toPromise();
  });

  it.each([
    ['approval', approveRequest(request), 'approveRegistration', approveSuccess.type, true],
    ['rejection', rejectRequest({ request, reason: null }), 'rejectRegistration', rejectSuccess.type, undefined],
    ['password resend', resendPassword(request.id), 'resetPassword', resendPasswordSuccess.type, true],
  ] as const)('does not publish stale %s result', async (_name, action, method, successType, result) => {
    const pending = deferred<never>();
    (api[method] as jest.Mock).mockReturnValue(pending.promise);
    const run = startWatcher(watchRequests);
    run.channel.put(action);
    expect(api[method]).toHaveBeenCalledTimes(1);

    run.state.auth.sessionEpoch = 2;
    pending.resolve(result as never);
    await settle();

    expect(run.dispatched).not.toContainEqual(expect.objectContaining({ type: successType }));
    run.task.cancel();
    await run.task.toPromise();
  });

  it('keeps publishing request data for the current session', async () => {
    api.getRegistrationRequests.mockResolvedValue({ items: [request], total: 1 });
    const run = startWatcher(watchRequests);
    run.channel.put(loadRequestsStart());
    await settle();

    expect(run.dispatched).toContainEqual(loadRequestsSuccess({ items: [request], total: 1 }));
    run.task.cancel();
    await run.task.toPromise();
  });

  it('does not publish presence fetched for a previous session', async () => {
    const pending = deferred<{ total: number; groups: null; withoutGroup: Array<{ id: string; firstName: string; surname: string }> }>();
    api.getPresence.mockReturnValue(pending.promise);
    const run = startWatcher(watchVisits);
    run.channel.put(loadPresentStart());
    expect(api.getPresence).toHaveBeenCalledTimes(1);

    run.state.auth.sessionEpoch = 2;
    pending.resolve({ total: 1, groups: null, withoutGroup: [{ id: 'child-1', firstName: 'Иван', surname: 'Иванов' }] });
    await settle();

    expect(run.dispatched).not.toContainEqual(expect.objectContaining({ type: loadPresentSuccess.type }));
    run.task.cancel();
    await run.task.toPromise();
  });

  it('does not publish a previous session visit history or failure', async () => {
    const pending = deferred<{ items: []; page: number; last: boolean }>();
    api.getVisits.mockReturnValue(pending.promise);
    const run = startWatcher(watchVisits);
    run.channel.put(loadJournalStart());
    expect(api.getVisits).toHaveBeenCalledWith(0);

    run.state.auth.sessionEpoch = 2;
    pending.reject(new Error('old visit request failed'));
    await settle();

    expect(run.dispatched).not.toContainEqual(expect.objectContaining({ type: loadJournalSuccess.type }));
    expect(run.dispatched).not.toContainEqual(expect.objectContaining({ type: loadJournalFailure.type }));
    run.task.cancel();
    await run.task.toPromise();
  });

  it('keeps publishing visit history for the current session', async () => {
    api.getVisits.mockResolvedValue({ items: [], page: 0, last: true });
    const run = startWatcher(watchVisits);
    run.channel.put(loadJournalStart());
    await settle();

    expect(run.dispatched).toContainEqual(loadJournalSuccess({ items: [], page: 0, last: true }));
    run.task.cancel();
    await run.task.toPromise();
  });
});
