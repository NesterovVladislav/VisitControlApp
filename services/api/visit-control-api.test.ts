import { AxiosAdapter, AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { clearAuthToken, setAuthToken, setUnauthorizedHandler } from '../auth/auth-token';
import { mapRegistrationRequest, toApproveBody, toUtcIso, toWallClockIso, visitControlApi } from './visit-control-api';
import { timeOfDay } from '../../utils/visit-dates';

type TestClient = { client: { defaults: { adapter?: AxiosAdapter } } };

const client = (visitControlApi as unknown as TestClient).client;
const originalAdapter = client.defaults.adapter;

function unauthorized(config: InternalAxiosRequestConfig): AxiosError {
  const response: AxiosResponse = {
    config,
    data: {},
    headers: {},
    status: 401,
    statusText: 'Unauthorized',
  };
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, {}, response);
}

describe('API session expiry', () => {
  afterEach(() => {
    client.defaults.adapter = originalAdapter;
    clearAuthToken();
    setUnauthorizedHandler(() => {});
  });

  it('ignores a delayed 401 from a previous session after a new token is installed', async () => {
    const expired = jest.fn();
    setUnauthorizedHandler(expired);
    setAuthToken('old-session-token');

    let rejectRequest!: (error: AxiosError) => void;
    let requestStarted!: (config: InternalAxiosRequestConfig) => void;
    const started = new Promise<InternalAxiosRequestConfig>((resolve) => {
      requestStarted = resolve;
    });
    client.defaults.adapter = ((config: AxiosRequestConfig) =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
        requestStarted(config as InternalAxiosRequestConfig);
      })) as AxiosAdapter;

    const previousRequest = visitControlApi.get('/user', {
      skipLogging: true,
      skipErrorHandling: true,
    }).catch((error) => error);
    const previousConfig = await started;
    expect(previousConfig.headers.Authorization).toBe('Bearer old-session-token');

    setAuthToken('new-session-token');
    rejectRequest(unauthorized(previousConfig));
    await previousRequest;

    expect(expired).not.toHaveBeenCalled();
  });

  it('expires the active session when its own token is rejected', async () => {
    const expired = jest.fn();
    setUnauthorizedHandler(expired);
    setAuthToken('active-session-token');
    client.defaults.adapter = (async (config) => Promise.reject(unauthorized(config))) as AxiosAdapter;

    await expect(visitControlApi.get('/user', {
      skipLogging: true,
      skipErrorHandling: true,
    })).rejects.toMatchObject({ status: 401 });

    expect(expired).toHaveBeenCalledTimes(1);
  });
});

describe('registration request mapping', () => {
  const dto = {
    external_key: 'r-1',
    surname: 'Иванова',
    first_name: 'Анна',
    email: 'anna@example.com',
    created: '2026-09-29T07:40:00',
  };

  // Стенд отдаёт LocalDate массивом: экран заявки падал на birthDate.split
  it('turns a birth date array from the server into YYYY-MM-DD', () => {
    expect(mapRegistrationRequest({ ...dto, birth_date: [1990, 5, 3] }).birthDate).toBe('1990-05-03');
  });

  it('takes the role and children with similar children of the kindergarten', () => {
    const view = mapRegistrationRequest({
      ...dto,
      role: 'PARENT',
      children: [{
        external_key: 'c-1', surname: 'Иванова', first_name: 'Маша', birth_date: [2022, 5, 1], gender: 'FEMALE',
        matches: [{ external_key: 'u-9', surname: 'Петрова', first_name: 'Маша', birth_date: '2022-05-01' }],
      }],
    });

    expect(view.role).toBe('PARENT');
    expect(view.children).toEqual([{
      id: 'c-1', surname: 'Иванова', firstName: 'Маша', patronymic: null, birthDate: '2022-05-01',
      gender: 'FEMALE',
      matches: [{ id: 'u-9', surname: 'Петрова', firstName: 'Маша', patronymic: null, birthDate: '2022-05-01' }],
    }]);
  });

  it('reads a request of the previous server version without role and children', () => {
    expect(mapRegistrationRequest(dto)).toMatchObject({ role: null, children: [] });
  });

  it('sends decisions on children and the changed role on approval', () => {
    expect(toApproveBody('role-employee', {
      'c-1': { kind: 'CREATE' },
      'c-2': { kind: 'LINK', childId: 'u-9' },
      'c-3': { kind: 'SKIP' },
    })).toEqual({
      role_external_key: 'role-employee',
      children: [
        { external_key: 'c-1', decision: 'CREATE' },
        { external_key: 'c-2', decision: 'LINK', child_external_key: 'u-9' },
        { external_key: 'c-3', decision: 'SKIP' },
      ],
    });
    expect(toApproveBody(null, {})).toEqual({ children: [] });
  });

  it('keeps a birth date string and a missing one', () => {
    expect(mapRegistrationRequest({ ...dto, birth_date: '1990-05-03' }).birthDate).toBe('1990-05-03');
    expect(mapRegistrationRequest(dto).birthDate).toBeNull();
  });
});

describe('kindergarten choice', () => {
  const requests: InternalAxiosRequestConfig[] = [];

  function respond(data: unknown) {
    client.defaults.adapter = ((config: InternalAxiosRequestConfig) => {
      requests.push(config);
      return Promise.resolve({ config, data, headers: {}, status: 200, statusText: 'OK' });
    }) as AxiosAdapter;
  }

  afterEach(() => {
    client.defaults.adapter = originalAdapter;
    requests.length = 0;
    clearAuthToken();
  });

  it('turns the logo path into a full URL and keeps a missing logo empty', async () => {
    respond([
      {
        external_key: 'org-1',
        name: 'Солнышко',
        address: 'ул. Ленина, 1',
        logo_url: '/organization/public/org-1/logo?v=1',
        registration_available: true,
      },
      { external_key: 'org-2', name: 'Ромашка', registration_available: false },
    ]);

    const organizations = await visitControlApi.getPublicOrganizations();

    expect(organizations).toEqual([
      {
        id: 'org-1',
        name: 'Солнышко',
        address: 'ул. Ленина, 1',
        logoUrl: `${visitControlApi.getBaseURL()}/organization/public/org-1/logo?v=1`,
        registrationAvailable: true,
      },
      { id: 'org-2', name: 'Ромашка', address: null, logoUrl: null, registrationAvailable: false },
    ]);
  });

  it('asks for the policy of the chosen kindergarten', async () => {
    respond({ version: '2026-10-01', url: 'https://example.test/p' });

    await visitControlApi.getPrivacyPolicy('org-1');

    expect(requests[0].url).toBe('/registration/policy');
    expect(requests[0].params).toEqual({ organization_external_key: 'org-1' });
  });

  it('takes the kindergarten of the signed-in user from GET /user', async () => {
    setAuthToken('token');
    respond({
      external_key: 'u-1',
      first_name: 'Мария',
      surname: 'Иванова',
      role: { role: 'PARENT' },
      organization: { external_key: 'org-1', name: 'Солнышко' },
    });

    const user = await visitControlApi.getMe();

    expect(user.organization).toEqual({ id: 'org-1', name: 'Солнышко' });
  });

  it('has no kindergarten for the technical administrator', async () => {
    setAuthToken('token');
    respond({ external_key: 'u-2', first_name: 'Тех', surname: 'Админ', role: { role: 'TECH_ADMIN' } });

    const user = await visitControlApi.getMe();

    expect(user.organization).toBeNull();
  });
});

describe('visit time from the backend', () => {
  it('shows the kindergarten clock as is, whatever the phone time zone', () => {
    // Бэкенд отдаёт отметку по часам сада без зоны: 15:35 в саду — это 15:35 на экране
    expect(timeOfDay(toWallClockIso([2026, 10, 12, 15, 35, 7, 8033000]))).toBe('15:35');
    expect(timeOfDay(toWallClockIso('2026-10-12T08:40:12.482915'))).toBe('08:40');
    expect(new Date(toWallClockIso([2026, 10, 12, 0, 5])).getDate()).toBe(12);
  });

  it('still converts a time with an explicit zone', () => {
    expect(toWallClockIso('2026-10-12T08:35:00Z')).toBe('2026-10-12T08:35:00.000Z');
    expect(toWallClockIso('2026-10-12T15:35:00+07:00')).toBe('2026-10-12T08:35:00.000Z');
  });

  it('reads the registration request time as UTC: the server writes it by its own clock', () => {
    expect(toUtcIso('2026-10-12T08:35:00.482915')).toBe('2026-10-12T08:35:00.482Z');
  });
});
