import { AxiosAdapter, AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { clearAuthToken, setAuthToken, setUnauthorizedHandler } from '../auth/auth-token';
import { visitControlApi } from './visit-control-api';

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
