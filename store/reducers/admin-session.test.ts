import { logoutCompleted } from './auth';
import requestsReducer, {
  approveRequest,
  approveSuccess,
  loadRequestsSuccess,
} from './requests';
import visitsReducer, {
  loadJournalSuccess,
  loadPresentSuccess,
} from './visits';

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
} as const;

describe('admin data isolation', () => {
  it('removes pending requests and outcomes after protected session logout', () => {
    const stillPending = { ...request, id: 'request-2', email: 'second@example.invalid' };
    let state = requestsReducer(undefined, loadRequestsSuccess({ items: [request, stillPending], total: 2 }));
    state = requestsReducer(state, approveRequest(request));
    state = requestsReducer(state, approveSuccess({ request, passwordSent: true }));

    const signedOut = requestsReducer(state, logoutCompleted({ reason: 'user' }));

    expect(signedOut).toEqual(requestsReducer(undefined, { type: 'test/initial' }));
    expect(JSON.stringify(signedOut)).not.toContain('anna@example.invalid');
  });

  it('removes presence and visit history after protected session logout', () => {
    let state = visitsReducer(undefined, loadPresentSuccess({
      total: 1,
      groups: null,
      withoutGroup: [{ id: 'child-1', firstName: 'Иван', surname: 'Иванов' }],
    }));
    state = visitsReducer(state, loadJournalSuccess({
      items: [{
        key: 'visit-1',
        childId: 'child-1',
        childName: 'Иван Иванов',
        representativeName: 'Иванова А.',
        status: 'IN',
        datetime: '2026-09-25T08:00:00.000Z',
      }],
      page: 0,
      last: true,
    }));

    const signedOut = visitsReducer(state, logoutCompleted({ reason: 'expired' }));

    expect(signedOut).toEqual(visitsReducer(undefined, { type: 'test/initial' }));
    expect(JSON.stringify(signedOut)).not.toContain('Иванов');
  });
});
