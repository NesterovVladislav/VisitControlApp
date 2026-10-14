import { runSaga } from 'redux-saga';

import { visitControlApi } from '../../services/api';
import {
  cancelMarkFinished,
  cancelMarkStart,
  loadChildrenSuccess,
  loadStatusStart,
  loadStatusSuccess,
  markVisitFailure,
  markVisitStale,
  markVisitStart,
  markVisitSuccess,
} from '../reducers/children';
import { ApiError } from '../../services/errors/api-error';
import {
  cancelMarkSaga,
  CHILDREN_MESSAGES,
  loadChildrenSaga,
  loadStatusSaga,
  markVisitSaga,
} from './children';
import { ChildVisit } from '../types/children';

jest.mock('../../services/api', () => ({
  visitControlApi: {
    getMyChildren: jest.fn(),
    getActualStatus: jest.fn(),
    createVisit: jest.fn(),
    cancelVisit: jest.fn(),
  },
}));
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: jest.fn(),
}));

const mockApi = visitControlApi as jest.Mocked<typeof visitControlApi>;

describe('children sagas sessionEpoch isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ignores a previous user child list after logout and another login', async () => {
    let resolveOld: ((children: Array<{
      id: string;
      firstName: string;
      surname: string;
      linkRole: string;
    }>) => void) | undefined;
    mockApi.getMyChildren.mockImplementation(() => new Promise((resolve) => {
      resolveOld = resolve;
    }));

    const state = {
      auth: { sessionEpoch: 1, user: { id: 'old-user' } },
      children: { items: [] },
    };
    const dispatched: unknown[] = [];
    const task = runSaga(
      {
        dispatch: (action) => dispatched.push(action),
        getState: () => state,
      },
      loadChildrenSaga,
    );

    expect(mockApi.getMyChildren).toHaveBeenCalledWith('old-user');
    state.auth = { sessionEpoch: 3, user: { id: 'new-user' } };
    resolveOld?.([
      { id: 'old-child', firstName: 'Old', surname: 'Child', linkRole: 'PARENT' },
    ]);
    await task.toPromise();

    expect(dispatched).not.toContainEqual(expect.objectContaining({
      type: loadChildrenSuccess.type,
    }));
  });

  it('ignores a previous session status response', async () => {
    let resolveOld: ((visit: ChildVisit) => void) | undefined;
    mockApi.getActualStatus.mockImplementation(() => new Promise((resolve) => {
      resolveOld = resolve;
    }));

    const state = {
      auth: { sessionEpoch: 5, user: { id: 'user' } },
      children: { items: [] },
    };
    const dispatched: unknown[] = [];
    const task = runSaga(
      {
        dispatch: (action) => dispatched.push(action),
        getState: () => state,
      },
      loadStatusSaga,
      loadStatusStart('child-1'),
    );

    state.auth = { sessionEpoch: 6, user: { id: 'other-user' } };
    resolveOld?.({ status: 'IN', decidedBy: null, decidedAt: null, pending: null, rejected: null });
    await task.toPromise();

    expect(dispatched).not.toContainEqual(expect.objectContaining({
      type: loadStatusSuccess.type,
    }));
  });
});

describe('marks waiting for the kindergarten', () => {
  const out: ChildVisit = { status: 'OUT', decidedBy: null, decidedAt: null, pending: null, rejected: null };
  const waiting: ChildVisit = {
    ...out,
    pending: { id: 'mark-1', status: 'IN', datetime: '2026-10-12T01:40:00.000Z' },
  };

  async function run(saga: Parameters<typeof runSaga>[1], action: unknown, statusById: object = {}) {
    const dispatched: { type: string; payload?: unknown }[] = [];
    await runSaga(
      {
        dispatch: (dispatchedAction: { type: string; payload?: unknown }) => dispatched.push(dispatchedAction),
        getState: () => ({ auth: { sessionEpoch: 1, user: { id: 'mother' } }, children: { items: [], statusById } }),
      },
      saga,
      action,
    ).toPromise();
    return dispatched;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends the comment with the mark and shows that it waits for the kindergarten', async () => {
    mockApi.getActualStatus.mockResolvedValueOnce(out).mockResolvedValueOnce(waiting);
    mockApi.createVisit.mockResolvedValue(undefined);

    const dispatched = await run(
      markVisitSaga,
      markVisitStart({ childId: 'child-1', seenStatus: 'OUT', comment: 'Привела бабушка' }),
    );

    expect(mockApi.createVisit).toHaveBeenCalledWith('child-1', 'mother', 'IN', 'Привела бабушка');
    expect(dispatched).toContainEqual(loadStatusSuccess({ childId: 'child-1', visit: waiting }));
    expect(dispatched).toContainEqual(markVisitSuccess('child-1'));
  });

  it('does not send a second mark while another representative mark is waiting', async () => {
    mockApi.getActualStatus.mockResolvedValue(waiting);

    const dispatched = await run(markVisitSaga, markVisitStart({ childId: 'child-1', seenStatus: 'OUT' }));

    expect(mockApi.createVisit).not.toHaveBeenCalled();
    expect(dispatched).toContainEqual(
      markVisitStale({ childId: 'child-1', notice: CHILDREN_MESSAGES.statusChanged }),
    );
  });

  it('explains a refusal of the server in plain words', async () => {
    mockApi.getActualStatus.mockResolvedValue({ ...out, status: 'IN' });
    mockApi.createVisit.mockRejectedValue(new ApiError('conflict', 409, '', { code: 'VISIT_NOT_IN' }));

    const dispatched = await run(markVisitSaga, markVisitStart({ childId: 'child-1', seenStatus: 'IN' }));

    expect(dispatched).toContainEqual(
      markVisitFailure({ childId: 'child-1', message: CHILDREN_MESSAGES.notIn }),
    );
  });

  it('cancels the waiting mark and rereads the status', async () => {
    mockApi.cancelVisit.mockResolvedValue(undefined);
    mockApi.getActualStatus.mockResolvedValue(out);

    const dispatched = await run(cancelMarkSaga, cancelMarkStart('child-1'), {
      'child-1': { value: 'OUT', visit: waiting },
    });

    expect(mockApi.cancelVisit).toHaveBeenCalledWith('mark-1');
    expect(dispatched).toContainEqual(loadStatusSuccess({ childId: 'child-1', visit: out }));
    expect(dispatched).toContainEqual(cancelMarkFinished({ childId: 'child-1', message: null }));
  });

  it('tells the parent when the kindergarten decided before the cancellation', async () => {
    mockApi.cancelVisit.mockRejectedValue(new ApiError('conflict', 409, '', { code: 'VISIT_ALREADY_DECIDED' }));
    mockApi.getActualStatus.mockResolvedValue({ ...out, status: 'IN', decidedBy: 'Петрова О.' });

    const dispatched = await run(cancelMarkSaga, cancelMarkStart('child-1'), {
      'child-1': { value: 'OUT', visit: waiting },
    });

    expect(dispatched).toContainEqual(
      cancelMarkFinished({ childId: 'child-1', message: CHILDREN_MESSAGES.cancelFailed }),
    );
  });
});
