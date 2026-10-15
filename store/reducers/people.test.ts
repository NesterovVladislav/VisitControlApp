import reducer, {
  clearPasswordReset,
  loadMorePeople,
  loadPeople,
  loadPeopleFailure,
  loadPeopleSuccess,
  resetPersonPassword,
  resetPersonPasswordFinished,
} from './people';
import { logoutCompleted } from './auth';
import { Person, PeopleQuery } from '../types/people';

const person = (id: string): Person => ({
  id,
  surname: 'Иванова',
  firstName: id,
  patronymic: null,
  role: 'PARENT',
  gender: 'FEMALE',
  birthDate: null,
  phone: '+79123456789',
  email: null,
  group: null,
  present: null,
  children: [],
});

const parents: PeopleQuery = { category: 'PARENT', q: '', groupFilter: { kind: 'all' } };

describe('people reducer', () => {
  it('starts a new list when the query changes and ignores the answer to the old one', () => {
    let state = reducer(undefined, loadPeople());
    const oldRequest = state.requestId;
    state = reducer(state, loadPeople({ query: parents }));
    expect(state).toMatchObject({ status: 'loading', items: [], query: parents });

    state = reducer(state, loadPeopleSuccess({
      requestId: oldRequest,
      result: { items: [person('child')], page: 0, last: true, total: 1 },
    }));
    expect(state.items).toEqual([]);

    state = reducer(state, loadPeopleSuccess({
      requestId: state.requestId,
      result: { items: [person('Анна')], page: 0, last: false, total: 2 },
    }));
    expect(state).toMatchObject({ status: 'loaded', total: 2, last: false });
    expect(state.items.map((p) => p.id)).toEqual(['Анна']);
  });

  it('appends the next page without duplicates', () => {
    let state = reducer(undefined, loadPeople({ query: parents }));
    const requestId = state.requestId;
    state = reducer(state, loadPeopleSuccess({ requestId, result: { items: [person('a'), person('b')], page: 0, last: false, total: 3 } }));
    state = reducer(state, loadMorePeople());
    expect(state.loadingMore).toBe(true);
    state = reducer(state, loadPeopleSuccess({ requestId, result: { items: [person('b'), person('c')], page: 1, last: true, total: 3 } }));
    expect(state.items.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(state).toMatchObject({ page: 1, last: true, loadingMore: false });
  });

  it('keeps the shown list when a refresh fails and offers retry for the next page', () => {
    let state = reducer(undefined, loadPeople({ query: parents }));
    state = reducer(state, loadPeopleSuccess({ requestId: state.requestId, result: { items: [person('a')], page: 0, last: false, total: 2 } }));
    state = reducer(state, loadPeople({ refresh: true }));
    state = reducer(state, loadPeopleFailure({ requestId: state.requestId, page: 0 }));
    expect(state).toMatchObject({ status: 'loaded', refreshing: false });

    state = reducer(state, loadMorePeople());
    state = reducer(state, loadPeopleFailure({ requestId: state.requestId, page: 1 }));
    expect(state).toMatchObject({ loadingMore: false, loadMoreFailed: true });
  });

  it('forgets phones and emails after logout', () => {
    let state = reducer(undefined, loadPeople({ query: parents }));
    state = reducer(state, loadPeopleSuccess({ requestId: state.requestId, result: { items: [person('a')], page: 0, last: true, total: 1 } }));
    const signedOut = reducer(state, logoutCompleted({ reason: 'user' }));
    expect(JSON.stringify(signedOut)).not.toContain('+79123456789');
  });

  it('runs one password reset at a time and keeps the result until it is shown', () => {
    let state = reducer(undefined, resetPersonPassword('a'));
    expect(state.passwordReset).toEqual({ personId: 'a', status: 'pending', message: null });

    state = reducer(state, resetPersonPassword('b'));
    expect(state.passwordReset?.personId).toBe('a');
    state = reducer(state, clearPasswordReset());
    expect(state.passwordReset?.status).toBe('pending');

    state = reducer(state, resetPersonPasswordFinished({ personId: 'a', status: 'sent', message: null }));
    expect(state.passwordReset).toMatchObject({ personId: 'a', status: 'sent' });
    state = reducer(state, clearPasswordReset());
    expect(state.passwordReset).toBeNull();
  });
});
