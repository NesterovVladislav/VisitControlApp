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

import { ApiError } from '../../services/errors/api-error';
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
import visitsReducer, {
  loadJournalFailure,
  loadJournalMore,
  journalAccessDenied,
  presentAccessDenied,
  loadJournalStart,
  loadJournalSuccess,
  loadPresentStart,
  loadPresentSuccess,
} from '../reducers/visits';
import { watchRequests } from './requests';
import { watchVisits } from './visits';
import { Presence } from '../types/visits';

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
  role: 'PARENT',
  children: [] as never[],
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
    visits: { journal: { revision: 1, page: 0, last: false, status: 'loaded' } },
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
    ['approval', approveRequest({ request, roleId: null, decisions: {} }), 'approveRegistration', approveSuccess.type, true],
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
    const pending = deferred<Presence>();
    api.getPresence.mockReturnValue(pending.promise);
    const run = startWatcher(watchVisits);
    run.channel.put(loadPresentStart());
    expect(api.getPresence).toHaveBeenCalledTimes(1);

    run.state.auth.sessionEpoch = 2;
    pending.resolve({
      total: 1,
      groups: null,
      withoutGroup: [{ id: 'child-1', firstName: 'Иван', surname: 'Иванов' }],
      branches: [],
    });
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

  it('discards a page requested before the journal was refreshed', async () => {
    const pending = deferred<{ items: []; page: number; last: boolean }>();
    api.getVisits.mockReturnValue(pending.promise);
    const run = startWatcher(watchVisits);
    run.channel.put(loadJournalMore());
    expect(api.getVisits).toHaveBeenCalledWith(1);
    run.state.visits.journal.revision += 1;
    pending.resolve({ items: [], page: 1, last: true });
    await settle();
    expect(run.dispatched).not.toContainEqual(expect.objectContaining({ type: loadJournalSuccess.type }));
    run.task.cancel();
    await run.task.toPromise();
  });

  it('finishes pagination after a refresh overtakes the previous next-page request', async () => {
    const first = { items: [], page: 0, last: false };
    const stale = deferred<{ items: []; page: number; last: boolean }>();
    api.getVisits.mockResolvedValueOnce(first).mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(first).mockResolvedValueOnce({ items: [], page: 1, last: true });

    const channel = stdChannel();
    let visits = visitsReducer(undefined, { type: 'init' });
    function dispatch(action: { type: string }) {
      visits = visitsReducer(visits, action);
      channel.put(action);
      return action;
    }
    const task = runSaga({ channel, getState: () => ({ auth: { sessionEpoch: 1 }, visits }), dispatch }, watchVisits);
    try {
      dispatch(loadJournalStart());
      await settle();
      dispatch(loadJournalMore());
      dispatch(loadJournalStart({ refresh: true }));
      await settle();
      dispatch(loadJournalMore());
      await settle();
      stale.resolve({ items: [], page: 1, last: false });
      await settle();

      expect(api.getVisits.mock.calls.map(([page]) => page)).toEqual([0, 1, 0, 1]);
      expect(visits.journal).toMatchObject({ loadingMore: false, page: 1, last: true });
    } finally {
      task.cancel();
      await task.toPromise();
    }
  });

  it('clears the journal and presence snapshots when the employee loses access', async () => {
    const forbidden = new ApiError('forbidden', 403);
    api.getVisits.mockRejectedValueOnce(forbidden);
    api.getPresence.mockRejectedValueOnce(forbidden);
    const run = startWatcher(watchVisits);
    run.channel.put(loadJournalStart());
    run.channel.put(loadPresentStart());
    await settle();
    expect(run.dispatched).toContainEqual(journalAccessDenied());
    expect(run.dispatched).toContainEqual(presentAccessDenied());
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
