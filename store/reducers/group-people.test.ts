import gardenReducer, { loadWithoutGroupCountSuccess, startGardenEdit } from './garden';
import reducer, { assignChild, assignChildSuccess, loadGroupPeople, loadGroupPeopleSuccess } from './group-people';
import { Person } from '../types/people';

const child = (id: string) => ({ id, firstName: id, surname: 'Иванов', group: null }) as Person;
const group = { id: 'g-1', name: 'Ромашка', branchId: 'b-1', branchName: 'Центральный' };

describe('group people reducer', () => {
  it('resets the list when another group or tab is opened and ignores outdated answers', () => {
    let state = reducer(undefined, loadGroupPeople({ query: { kind: 'group', groupId: 'g-1', category: 'CHILD' } }));
    const stale = state.requestId;
    state = reducer(state, loadGroupPeople({ query: { kind: 'group', groupId: 'g-1', category: 'PARENT' } }));
    state = reducer(state, loadGroupPeopleSuccess({ requestId: stale, result: { items: [child('a')], page: 0, last: true, total: 1 } }));
    expect(state.status).toBe('loading');
    expect(state.items).toEqual([]);
  });

  it('removes an assigned child from «Дети без группы» and lowers the counter', () => {
    let state = reducer(undefined, loadGroupPeople({ query: { kind: 'withoutGroup', q: '' } }));
    state = reducer(
      state,
      loadGroupPeopleSuccess({ requestId: state.requestId, result: { items: [child('a'), child('b')], page: 0, last: true, total: 2 } })
    );
    state = reducer(state, assignChild({ child: state.items[0], group }));
    expect(state.saving).toEqual({ a: true });
    state = reducer(state, assignChildSuccess({ childId: 'a' }));
    expect(state.items.map((person) => person.id)).toEqual(['b']);
    expect(state.total).toBe(1);

    let garden = gardenReducer(undefined, loadWithoutGroupCountSuccess(2));
    garden = gardenReducer(garden, assignChildSuccess({ childId: 'a' }));
    expect(garden.withoutGroupCount).toBe(1);
  });
});

describe('garden reducer', () => {
  it('does not start a second change while one is saving', () => {
    let state = gardenReducer(undefined, startGardenEdit({ type: 'deleteGroup', id: 'g-1' }));
    state = gardenReducer(state, startGardenEdit({ type: 'deleteBranch', id: 'b-1' }));
    expect(state.edit.action).toEqual({ type: 'deleteGroup', id: 'g-1' });
  });
});
