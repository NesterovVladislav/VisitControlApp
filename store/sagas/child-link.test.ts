import { runSaga } from 'redux-saga';

import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import { linkCandidatesLoaded, linkChild, linkChildFinished } from '../reducers/child-link';
import { loadPeople } from '../reducers/people';
import { CHILD_LINK_ERRORS, linkChildSaga, loadCandidatesSaga } from './child-link';

jest.mock('../../services/api', () => ({
  visitControlApi: { getPeople: jest.fn(), linkChild: jest.fn() },
}));

const mockApi = visitControlApi as jest.Mocked<typeof visitControlApi>;
const maria = {
  id: 'maria',
  surname: 'Иванова',
  firstName: 'Мария',
  patronymic: null,
  role: 'VISITOR',
  gender: 'FEMALE' as const,
  birthDate: null,
  phone: null,
  email: null,
  group: null,
  present: null,
  children: null,
};
const mother = { ...maria, id: 'mother', firstName: 'Анна', role: 'PARENT' };

function run(saga: () => Generator, childLink: Record<string, unknown>) {
  const dispatched: unknown[] = [];
  const task = runSaga(
    {
      dispatch: (action) => dispatched.push(action),
      getState: () => ({ auth: { sessionEpoch: 1 }, childLink: { adult: mother, q: 'мар', requestId: 3, ...childLink } }),
    },
    saga,
  );
  return { dispatched, done: task.toPromise() };
}

describe('child link saga', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('searches children of the kindergarten', async () => {
    mockApi.getPeople.mockResolvedValue({ items: [maria], page: 0, last: true, total: 1 });
    const { dispatched, done } = run(loadCandidatesSaga, {});
    await done;
    expect(mockApi.getPeople).toHaveBeenCalledWith({ category: 'CHILD', q: 'мар', groupFilter: { kind: 'all' } }, 0, 30);
    expect(dispatched).toEqual([linkCandidatesLoaded({ requestId: 3, items: [maria] })]);
  });

  it('links the child to the adult and refreshes the people list', async () => {
    mockApi.linkChild.mockResolvedValue(undefined);
    const { dispatched, done } = run(() => linkChildSaga(linkChild({ child: maria, linkRole: 'PARENT' })), {});
    await done;
    expect(mockApi.linkChild).toHaveBeenCalledWith('maria', 'mother', 'PARENT');
    expect(dispatched).toEqual([
      linkChildFinished({ childId: 'maria', status: 'linked', message: null }),
      loadPeople({ refresh: true }),
    ]);
  });

  it('explains an existing link', async () => {
    mockApi.linkChild.mockRejectedValue(new ApiError('Conflict', 409));
    const { dispatched, done } = run(() => linkChildSaga(linkChild({ child: maria, linkRole: 'PARENT' })), {});
    await done;
    expect(dispatched).toEqual([
      linkChildFinished({ childId: 'maria', status: 'failed', message: CHILD_LINK_ERRORS.duplicate }),
    ]);
  });
});
