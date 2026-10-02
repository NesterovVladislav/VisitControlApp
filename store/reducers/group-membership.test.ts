import reducer, {
  loadCandidates,
  loadCandidatesSuccess,
  putChildInGroup,
  changeMembershipFailure,
  putChildInGroupSuccess,
  removeChildFromGroup,
  removeChildFromGroupSuccess,
} from './group-membership';
import { Person } from '../types/people';

const group = { id: 'g-new', name: 'Новая', branchId: null, branchName: null };
const other = { id: 'g-old', name: 'Ромашка', branchId: null, branchName: null };
const child = (id: string, inGroup: typeof group | null = null) =>
  ({ id, firstName: id, surname: 'Иванов', group: inGroup }) as Person;

describe('group membership reducer', () => {
  it('ignores an answer to an outdated search', () => {
    let state = reducer(undefined, loadCandidates({ group, filter: 'withoutGroup', q: 'и' }));
    const staleId = state.requestId;
    state = reducer(state, loadCandidates({ group, filter: 'withoutGroup', q: 'ив' }));
    state = reducer(
      state,
      loadCandidatesSuccess({ requestId: staleId, result: { items: [child('a')], page: 0, last: true, total: 1 } })
    );
    expect(state.status).toBe('loading');
    expect(state.items).toEqual([]);
  });

  it('keeps the added child in the list with the new group', () => {
    let state = reducer(undefined, loadCandidates({ group, filter: 'all', q: '' }));
    state = reducer(
      state,
      loadCandidatesSuccess({
        requestId: state.requestId,
        result: { items: [child('a', other), child('b')], page: 0, last: true, total: 2 },
      })
    );
    state = reducer(state, putChildInGroup(state.items[0]));
    expect(state.saving).toEqual({ a: true });

    state = reducer(state, putChildInGroupSuccess({ childId: 'a', group }));
    expect(state.saving).toEqual({});
    expect(state.items.map((person) => person.group?.id ?? null)).toEqual(['g-new', null]);
  });

  it('keeps a removed child in the list without a group, so it can be added back', () => {
    let state = reducer(undefined, loadCandidates({ group, filter: 'inGroup', q: '' }));
    state = reducer(
      state,
      loadCandidatesSuccess({ requestId: state.requestId, result: { items: [child('a', group)], page: 0, last: true, total: 1 } })
    );
    state = reducer(state, removeChildFromGroup(state.items[0]));
    expect(state.saving).toEqual({ a: true });

    state = reducer(state, removeChildFromGroupSuccess({ childId: 'a' }));
    expect(state.saving).toEqual({});
    expect(state.items).toHaveLength(1);
    expect(state.items[0].group).toBeNull();
  });

  it('remembers a failure until the next try and forgets it for another group', () => {
    let state = reducer(undefined, loadCandidates({ group, filter: 'withoutGroup', q: '' }));
    state = reducer(state, putChildInGroup(child('b')));
    state = reducer(state, changeMembershipFailure({ childId: 'b', message: 'Ошибка' }));
    expect(state.failed).toEqual({ b: 'Ошибка' });

    expect(reducer(state, putChildInGroup(child('b'))).failed).toEqual({});
    expect(reducer(state, loadCandidates({ group: other, filter: 'withoutGroup', q: '' })).failed).toEqual({});
  });
});
