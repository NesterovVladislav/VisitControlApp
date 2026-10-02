import { runSaga } from 'redux-saga';

import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import {
  loadCandidatesSuccess,
  putChildInGroup,
  changeMembershipFailure,
  putChildInGroupSuccess,
  removeChildFromGroup,
  removeChildFromGroupSuccess,
} from '../reducers/group-membership';
import { loadWithoutGroupCount } from '../reducers/garden';
import { loadPeople } from '../reducers/people';
import { loadPresentStart } from '../reducers/visits';
import { Person } from '../types/people';
import { MEMBERSHIP_MESSAGES, loadFirstPageSaga, putChildInGroupSaga, removeChildFromGroupSaga } from './group-membership';

jest.mock('../../services/api', () => ({
  visitControlApi: { getPeople: jest.fn(), putChildInGroup: jest.fn(), removeChildFromGroup: jest.fn() },
}));

const mockApi = visitControlApi as jest.Mocked<typeof visitControlApi>;
const group = { id: 'g-new', name: 'Новая', branchId: 'b-1', branchName: 'Центральный' };
const child = { id: 'c-1', firstName: 'Мария', surname: 'Иванова', group: null } as Person;
const page = { items: [child], page: 0, last: true, total: 1 };

function run(
  saga: (...args: any[]) => Generator,
  membership: Record<string, unknown>,
  { arg, peopleStatus = 'idle', epoch = { value: 1 } }: { arg?: unknown; peopleStatus?: string; epoch?: { value: number } } = {}
) {
  const dispatched: unknown[] = [];
  const task = runSaga(
    {
      dispatch: (action) => dispatched.push(action),
      getState: () => ({
        auth: { sessionEpoch: epoch.value },
        people: { status: peopleStatus, filterOptions: { status: 'idle' } },
        groupMembership: { group, filter: 'withoutGroup', q: '', requestId: 3, ...membership },
      }),
    },
    saga,
    arg
  );
  return { dispatched, done: task.toPromise() };
}

describe('group membership saga', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('loads children without a group first, then all children', async () => {
    mockApi.getPeople.mockResolvedValue(page);
    const { dispatched, done } = run(loadFirstPageSaga, { q: 'мар' });
    await done;
    expect(mockApi.getPeople).toHaveBeenCalledWith(
      { category: 'CHILD', q: 'мар', groupFilter: { kind: 'withoutGroup' } },
      0
    );
    expect(dispatched).toEqual([loadCandidatesSuccess({ requestId: 3, result: page })]);

    await run(loadFirstPageSaga, { filter: 'all' }).done;
    expect(mockApi.getPeople).toHaveBeenLastCalledWith({ category: 'CHILD', q: '', groupFilter: { kind: 'all' } }, 0);
  });

  it('loads children of the group for «В группе»', async () => {
    mockApi.getPeople.mockResolvedValue(page);
    await run(loadFirstPageSaga, { filter: 'inGroup' }).done;
    expect(mockApi.getPeople).toHaveBeenCalledWith(
      { category: 'CHILD', q: '', groupFilter: { kind: 'group', id: 'g-new', name: 'Новая' } },
      0
    );
  });

  it('removes the child from the group and refreshes presence', async () => {
    mockApi.removeChildFromGroup.mockResolvedValue(undefined);
    const { dispatched, done } = run(removeChildFromGroupSaga, {}, { arg: removeChildFromGroup(child) });
    await done;
    expect(mockApi.removeChildFromGroup).toHaveBeenCalledWith('g-new', 'c-1');
    expect(dispatched).toEqual([
      removeChildFromGroupSuccess({ childId: 'c-1' }),
      loadPresentStart({ refresh: true }),
      loadWithoutGroupCount(),
    ]);
  });

  it('marks the row when removal fails', async () => {
    mockApi.removeChildFromGroup.mockRejectedValue(new ApiError('Server error', 500));
    const { dispatched, done } = run(removeChildFromGroupSaga, {}, { arg: removeChildFromGroup(child) });
    await done;
    expect(dispatched).toEqual([
      changeMembershipFailure({ childId: 'c-1', message: MEMBERSHIP_MESSAGES.removeGeneric }),
    ]);
  });

  it('puts the child in the group and refreshes presence and a loaded people list', async () => {
    mockApi.putChildInGroup.mockResolvedValue(undefined);
    const { dispatched, done } = run(putChildInGroupSaga, {}, { arg: putChildInGroup(child), peopleStatus: 'loaded' });
    await done;
    expect(mockApi.putChildInGroup).toHaveBeenCalledWith('g-new', 'c-1');
    expect(dispatched).toEqual([
      putChildInGroupSuccess({ childId: 'c-1', group }),
      loadPresentStart({ refresh: true }),
      loadWithoutGroupCount(),
      loadPeople({ refresh: true }),
    ]);
  });

  it('marks the row when the child or group is gone', async () => {
    mockApi.putChildInGroup.mockRejectedValue(new ApiError('Not found', 404));
    const { dispatched, done } = run(putChildInGroupSaga, {}, { arg: putChildInGroup(child) });
    await done;
    expect(dispatched).toEqual([changeMembershipFailure({ childId: 'c-1', message: MEMBERSHIP_MESSAGES.gone })]);
  });

  it('drops the answer after logout', async () => {
    let resolve: (() => void) | undefined;
    mockApi.putChildInGroup.mockImplementation(() => new Promise<void>((r) => { resolve = r; }));
    const epoch = { value: 1 };
    const { dispatched, done } = run(putChildInGroupSaga, {}, { arg: putChildInGroup(child), epoch });
    epoch.value = 2;
    resolve?.();
    await done;
    expect(dispatched).toEqual([]);
  });
});
