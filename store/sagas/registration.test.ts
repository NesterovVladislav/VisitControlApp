import { runSaga } from 'redux-saga';

import { visitControlApi } from '../../services/api';
import { ApiError } from '../../services/errors/api-error';
import {
  loadOrganizationsStart,
  loadOrganizationsSuccess,
  loadPolicySuccess,
  registerFailure,
  registerStart,
  selectOrganization,
} from '../reducers/registration';
import { PublicOrganization, RegistrationRequest } from '../types/registration';
import { loadOrganizationsSaga, loadPolicySaga, REGISTRATION_ERRORS, registerSaga } from './registration';

jest.mock('../../services/api', () => ({
  visitControlApi: {
    getPublicOrganizations: jest.fn(),
    getPrivacyPolicy: jest.fn(),
    register: jest.fn(),
  },
}));

const mockApi = visitControlApi as jest.Mocked<typeof visitControlApi>;

const sunshine: PublicOrganization = {
  id: 'org-1',
  name: 'Солнышко',
  address: null,
  logoUrl: null,
  registrationAvailable: true,
};
const chamomile: PublicOrganization = { ...sunshine, id: 'org-2', name: 'Ромашка' };

async function run(
  saga: (...args: never[]) => Generator,
  state: Record<string, unknown> = {},
  ...args: unknown[]
): Promise<unknown[]> {
  const dispatched: unknown[] = [];
  // runSaga типизирован по аргументам конкретной саги, здесь помощник общий
  const start = runSaga as (...params: unknown[]) => ReturnType<typeof runSaga>;
  await start(
    { dispatch: (action: unknown) => dispatched.push(action), getState: () => state },
    saga,
    ...args,
  ).toPromise();
  return dispatched;
}

describe('registration sagas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('selects the only kindergarten right away', async () => {
    mockApi.getPublicOrganizations.mockResolvedValue([sunshine]);

    const dispatched = await run(loadOrganizationsSaga);

    expect(dispatched).toEqual([loadOrganizationsSuccess([sunshine]), selectOrganization(sunshine)]);
  });

  it('lets the parent choose when there are several kindergartens', async () => {
    mockApi.getPublicOrganizations.mockResolvedValue([sunshine, chamomile]);

    const dispatched = await run(loadOrganizationsSaga);

    expect(dispatched).toEqual([loadOrganizationsSuccess([sunshine, chamomile])]);
  });

  it('does not select the only kindergarten if it does not accept requests', async () => {
    const closed = { ...sunshine, registrationAvailable: false };
    mockApi.getPublicOrganizations.mockResolvedValue([closed]);

    const dispatched = await run(loadOrganizationsSaga);

    expect(dispatched).toEqual([loadOrganizationsSuccess([closed])]);
  });

  it('loads the policy of the selected kindergarten', async () => {
    const policy = { version: '2026-10-01', url: 'https://example.test/p' };
    mockApi.getPrivacyPolicy.mockResolvedValue(policy);

    const dispatched = await run(loadPolicySaga, { registration: { organization: chamomile } });

    expect(mockApi.getPrivacyPolicy).toHaveBeenCalledWith('org-2');
    expect(dispatched).toEqual([loadPolicySuccess(policy)]);
  });

  it('does not load a policy before a kindergarten is selected', async () => {
    const dispatched = await run(loadPolicySaga, { registration: { organization: null } });

    expect(mockApi.getPrivacyPolicy).not.toHaveBeenCalled();
    expect(dispatched).toEqual([]);
  });

  it('returns to the kindergarten list and keeps the message when the kindergarten is gone', async () => {
    mockApi.register.mockRejectedValue(new ApiError('Not found', 404, 'Not Found', { code: 'NOT_FOUND' }));

    const dispatched = await run(registerSaga, {}, registerStart({} as RegistrationRequest));

    // Смена сада сбрасывает ошибку формы, поэтому ошибка — последней
    expect(dispatched).toEqual([
      selectOrganization(null),
      loadOrganizationsStart(),
      registerFailure({ formError: REGISTRATION_ERRORS.organizationNotFound, resetOrganization: true }),
    ]);
  });
});
