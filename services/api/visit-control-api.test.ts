import { AxiosAdapter, AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { clearAuthToken, setAuthToken, setUnauthorizedHandler } from '../auth/auth-token';
import { mapRegistrationRequest, toApproveBody, toUtcIso, toWallClockIso, visitControlApi } from './visit-control-api';
import { timeOfDay } from '../../utils/visit-dates';

type TestClient = { client: { defaults: { adapter?: AxiosAdapter } } };

const client = (visitControlApi as unknown as TestClient).client;
const originalAdapter = client.defaults.adapter;

describe('own profile update contract', () => {
  afterEach(() => { client.defaults.adapter = originalAdapter; clearAuthToken(); });

  it('sends gender to the own-profile endpoint and maps the saved response', async () => {
    const update = {
      surname: 'Смирнова', first_name: 'Анна', patronymic: null, birth_date: '1990-03-14',
      phone: null, gender: 'MALE' as const,
    };
    let sent: InternalAxiosRequestConfig | undefined;
    client.defaults.adapter = async (config) => {
      sent = config;
      return { config, data: { ...update, external_key: 'parent-1', email: 'parent@example.test',
        role: { role: 'PARENT' }, organization: null }, headers: {}, status: 200, statusText: 'OK' };
    };
    setAuthToken('synthetic-session-token');
    const saved = await visitControlApi.updateMe(update);
    expect(sent?.method).toBe('put');
    expect(sent?.url).toBe('/user/me');
    expect(JSON.parse(sent?.data)).toEqual(update);
    expect(saved).toMatchObject({ id: 'parent-1', surname: 'Смирнова', gender: 'MALE', role: 'PARENT' });
  });
});

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

describe('public password reset API', () => {
  afterEach(() => {
    client.defaults.adapter = originalAdapter;
    clearAuthToken();
  });

  it('sends each POST once, without the current session token', async () => {
    setAuthToken('existing-session');
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
      const replies: Record<string, object> = {
        '/password/reset/request': { resend_after_sec: 60, code_ttl_sec: 900 },
        '/password/reset/verify': { reset_token: 'synthetic-reset', expires_in_sec: 600 },
        '/password/reset/confirm': { access_token: 'synthetic-session' },
      };
      return { config, data: replies[config.url ?? ''], headers: {}, status: 200, statusText: 'OK' };
    });
    client.defaults.adapter = adapter;
    const { signal } = new AbortController();

    await expect(visitControlApi.requestPasswordReset('parent@example.org', signal)).resolves.toEqual({
      resend_after_sec: 60, code_ttl_sec: 900,
    });
    await expect(visitControlApi.verifyPasswordReset('parent@example.org', '012345', signal)).resolves.toEqual({
      reset_token: 'synthetic-reset', expires_in_sec: 600,
    });
    await expect(visitControlApi.confirmPasswordReset('synthetic-reset', ' new password ', signal))
      .resolves.toBe('synthetic-session');
    expect(adapter.mock.calls.map(([config]) => [config.url, JSON.parse(config.data)])).toEqual([
      ['/password/reset/request', { email: 'parent@example.org' }],
      ['/password/reset/verify', { email: 'parent@example.org', code: '012345' }],
      ['/password/reset/confirm', { reset_token: 'synthetic-reset', new_password: ' new password ' }],
    ]);
    for (const [config] of adapter.mock.calls) {
      expect(config.headers.toJSON().Authorization).toBeUndefined();
      expect(config).toMatchObject({ skipLogging: true, skipErrorHandling: true, signal });
    }
  });

  it('retains Retry-After and attempts_left without retaining the request or server text', async () => {
    const { signal } = new AbortController();
    function fail(status: number, data: object, headers: Record<string, string> = {}) {
      client.defaults.adapter = async (config) => {
        throw new AxiosError('fixture error', 'ERR_BAD_REQUEST', config, {}, {
          config, status, statusText: 'Error', headers, data,
        });
      };
    }
    fail(400, { code: 'RESET_CODE_INVALID', attempts_left: 2, message: 'untrusted response text' });
    const invalid = await visitControlApi.verifyPasswordReset('parent@example.org', '012345', signal)
      .catch((error: unknown) => error);
    expect(invalid).toMatchObject({ status: 400, code: 'RESET_CODE_INVALID', attemptsLeft: 2 });
    expect(invalid).not.toHaveProperty('originalError');
    expect(invalid).not.toHaveProperty('data');
    fail(429, {}, { 'Retry-After': '60' });
    const after = Date.now() + 60_000;
    const throttled = await visitControlApi.requestPasswordReset('parent@example.org', signal)
      .catch((error: unknown) => error) as { status: number; retryAt: number };
    expect(throttled.status).toBe(429);
    expect(throttled.retryAt).toBeGreaterThanOrEqual(after);
    expect(throttled.retryAt).toBeLessThan(after + 1000);
  });
});

describe('profile password change response', () => {
  afterEach(() => {
    client.defaults.adapter = originalAdapter;
    clearAuthToken();
  });

  it.each([
    [200, { access_token: 'replacement' }, 'replacement'],
    [204, undefined, undefined],
    [200, {}, undefined],
    [200, '', undefined],
  ])('accepts status %s with response %j', async (status, data, expected) => {
    setAuthToken('current-session');
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => ({
      config, data, status, statusText: 'Success', headers: {},
    }));
    client.defaults.adapter = adapter;

    await expect(visitControlApi.changePassword('old-password', 'new-password')).resolves.toBe(expected);
    expect(adapter).toHaveBeenCalledTimes(1);
    const [[request]] = adapter.mock.calls;
    expect(request).toMatchObject({ method: 'patch', url: '/user/password', skipLogging: true });
    expect(request.headers.Authorization).toBe('Bearer current-session');
  });
});
