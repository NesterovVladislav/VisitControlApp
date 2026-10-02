import { runSaga } from 'redux-saga';

import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { gardenEditFailed, gardenEditSucceeded, loadWithoutGroupCount, loadWithoutGroupCountSuccess, startGardenEdit } from '../reducers/garden';
import { loadPresentStart } from '../reducers/visits';
import { gardenEditSaga, loadWithoutGroupCountSaga, toGardenEditError } from './garden';

jest.mock('../../services/api', () => ({
  visitControlApi: {
    getPeople: jest.fn(),
    createBranch: jest.fn(),
    renameBranch: jest.fn(),
    deleteBranch: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
  },
}));

const mockApi = visitControlApi as jest.Mocked<typeof visitControlApi>;

function run(saga: (...args: any[]) => Generator, arg?: unknown, epoch = { value: 1 }) {
  const dispatched: unknown[] = [];
  const task = runSaga(
    {
      dispatch: (action) => dispatched.push(action),
      getState: () => ({ auth: { sessionEpoch: epoch.value }, people: { status: 'idle', filterOptions: { status: 'idle' } } }),
    },
    saga,
    arg
  );
  return { dispatched, done: task.toPromise() };
}

const refreshed = [loadPresentStart({ refresh: true }), loadWithoutGroupCount()];

describe('garden saga', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('counts children without a group with a one-row page', async () => {
    mockApi.getPeople.mockResolvedValue({ items: [], page: 0, last: false, total: 3 });
    const { dispatched, done } = run(loadWithoutGroupCountSaga);
    await done;
    expect(mockApi.getPeople).toHaveBeenCalledWith({ category: 'CHILD', q: '', groupFilter: { kind: 'withoutGroup' } }, 0, 1);
    expect(dispatched).toEqual([loadWithoutGroupCountSuccess(3)]);
  });

  it('creates a group, refreshes the garden and returns the new id', async () => {
    mockApi.createGroup.mockResolvedValue({ id: 'g-new', name: 'Новая', branchId: 'b-1' });
    const { dispatched, done } = run(
      gardenEditSaga,
      startGardenEdit({ type: 'saveGroup', id: null, name: 'Новая', branchId: 'b-1' })
    );
    await done;
    expect(mockApi.createGroup).toHaveBeenCalledWith('Новая', 'b-1');
    expect(dispatched).toEqual([...refreshed, gardenEditSucceeded({ createdId: 'g-new' })]);
  });

  it('renames and moves a group without a new id', async () => {
    mockApi.updateGroup.mockResolvedValue({ id: 'g-1', name: 'Ромашка', branchId: 'b-2' });
    const { dispatched, done } = run(gardenEditSaga, startGardenEdit({ type: 'saveGroup', id: 'g-1', name: 'Ромашка', branchId: 'b-2' }));
    await done;
    expect(mockApi.updateGroup).toHaveBeenCalledWith('g-1', 'Ромашка', 'b-2');
    expect(dispatched).toEqual([...refreshed, gardenEditSucceeded({ createdId: null })]);
  });

  it('reports a non-empty group with the count from the server and refreshes stale data', async () => {
    mockApi.deleteGroup.mockRejectedValue(
      new ApiError('Conflict', 409, '', { code: 'GROUP_NOT_EMPTY', children_count: 2 })
    );
    const { dispatched, done } = run(gardenEditSaga, startGardenEdit({ type: 'deleteGroup', id: 'g-1' }));
    await done;
    expect(dispatched).toEqual([...refreshed, gardenEditFailed({ kind: 'notEmpty', count: 2 })]);
  });

  it('maps server errors to what the screen shows', () => {
    expect(toGardenEditError(new ApiError('Conflict', 409, '', { code: 'NAME_TAKEN' }))).toEqual({ kind: 'nameTaken' });
    expect(toGardenEditError(new ApiError('Conflict', 409, '', { code: 'BRANCH_NOT_EMPTY', groups_count: 4 }))).toEqual({
      kind: 'notEmpty',
      count: 4,
    });
    expect(toGardenEditError(new ApiError('Not found', 404))).toEqual({ kind: 'gone' });
    expect(toGardenEditError(new Error('boom'))).toEqual({ kind: 'generic' });
  });

  it('drops the answer after logout', async () => {
    let resolve: (() => void) | undefined;
    mockApi.deleteBranch.mockImplementation(() => new Promise<void>((r) => { resolve = r; }));
    const epoch = { value: 1 };
    const { dispatched, done } = run(gardenEditSaga, startGardenEdit({ type: 'deleteBranch', id: 'b-1' }), epoch);
    epoch.value = 2;
    resolve?.();
    await done;
    expect(dispatched).toEqual([]);
  });
});
