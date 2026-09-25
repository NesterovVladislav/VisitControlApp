import { runSaga } from 'redux-saga';

import { visitControlApi } from '../../services/api';
import {
  loadChildrenSuccess,
  loadStatusStart,
  loadStatusSuccess,
} from '../reducers/children';
import { loadChildrenSaga, loadStatusSaga } from './children';

jest.mock('../../services/api', () => ({
  visitControlApi: {
    getMyChildren: jest.fn(),
    getActualStatus: jest.fn(),
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
    let resolveOld: ((status: 'IN') => void) | undefined;
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
    resolveOld?.('IN');
    await task.toPromise();

    expect(dispatched).not.toContainEqual(expect.objectContaining({
      type: loadStatusSuccess.type,
    }));
  });
});
