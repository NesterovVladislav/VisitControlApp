import reducer, {
  clearChildLinkResult,
  closeChildLink,
  linkCandidatesLoaded,
  linkChild,
  linkChildFinished,
  openChildLink,
  searchLinkCandidates,
} from './child-link';
import { logoutCompleted } from './auth';
import { Person } from '../types/people';

const person = (id: string, role = 'VISITOR'): Person => ({
  id,
  surname: 'Иванова',
  firstName: id,
  patronymic: null,
  role,
  gender: 'FEMALE',
  birthDate: null,
  phone: null,
  email: null,
  group: null,
  present: null,
  children: null,
});

describe('child link reducer', () => {
  it('opens for an adult and ignores answers to an old search', () => {
    let state = reducer(undefined, openChildLink(person('mother', 'PARENT')));
    expect(state).toMatchObject({ adult: { id: 'mother' }, status: 'loading', q: '' });
    const oldRequest = state.requestId;

    state = reducer(state, searchLinkCandidates('Мар'));
    state = reducer(state, linkCandidatesLoaded({ requestId: oldRequest, items: [person('old')] }));
    expect(state.status).toBe('loading');

    state = reducer(state, linkCandidatesLoaded({ requestId: state.requestId, items: [person('maria')] }));
    expect(state).toMatchObject({ status: 'loaded', candidates: [{ id: 'maria' }] });
  });

  it('links one child at a time and stays open while it is in progress', () => {
    let state = reducer(undefined, openChildLink(person('mother', 'PARENT')));
    state = reducer(state, linkChild({ child: person('maria'), linkRole: 'PARENT' }));
    state = reducer(state, linkChild({ child: person('petya'), linkRole: 'PARENT' }));
    expect(state.link).toEqual({ childId: 'maria', status: 'pending', message: null });

    state = reducer(state, closeChildLink());
    expect(state.adult?.id).toBe('mother');

    state = reducer(state, linkChildFinished({ childId: 'maria', status: 'linked', message: null }));
    state = reducer(state, clearChildLinkResult());
    expect(state.link).toBeNull();
    state = reducer(state, closeChildLink());
    expect(state.adult).toBeNull();
  });

  it('forgets everything after logout', () => {
    const state = reducer(reducer(undefined, openChildLink(person('mother', 'PARENT'))), logoutCompleted({ reason: 'user' }));
    expect(state.adult).toBeNull();
  });
});
