import { AxiosAdapter, AxiosError, InternalAxiosRequestConfig } from 'axios';

import { clearAuthToken, getAuthToken, setAuthToken, setUnauthorizedHandler } from '../auth/auth-token';
import { ApiError } from '../errors/api-error';
import { visitControlApi } from './visit-control-api';

const client = (visitControlApi as unknown as {
  client: { defaults: { adapter?: AxiosAdapter } };
}).client;
const originalAdapter = client.defaults.adapter;
const profile = { external_key: 'synthetic-user', first_name: 'Test', surname: 'Test', role: { role: 'PARENT' } };

function response(config: InternalAxiosRequestConfig) {
  return { config, data: profile, headers: {}, status: 200, statusText: 'OK' };
}

function failure(config: InternalAxiosRequestConfig, status?: number) {
  return new AxiosError(
    'Synthetic failure', status ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK', config, {},
    status ? { config, data: {}, headers: {}, status, statusText: 'Error' } : undefined,
  );
}

describe('session validation time budget', () => {
  let requests: InternalAxiosRequestConfig[];
  let log: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    requests = [];
    setAuthToken('synthetic-token');
    setUnauthorizedHandler(() => {});
    log = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    client.defaults.adapter = originalAdapter;
    clearAuthToken();
    setUnauthorizedHandler(() => {});
    jest.clearAllTimers();
    jest.useRealTimers();
    log.mockRestore();
  });

  it('returns a fast profile without waiting or leaving deadline timers', async () => {
    client.defaults.adapter = async config => { requests.push(config); return response(config); };

    expect(await visitControlApi.getMe()).toMatchObject({ id: 'synthetic-user', role: 'PARENT' });
    expect(requests).toHaveLength(1);
    expect(requests[0].timeout).toBe(4_000);
    expect(jest.getTimerCount()).toBe(0);
    expect(getAuthToken()).toBe('synthetic-token');
  });

  it.each([undefined, 500, 502, 408, 429])('recovers after one temporary error (%s)', async status => {
    client.defaults.adapter = async config => {
      requests.push(config);
      if (requests.length === 1) throw failure(config, status);
      return response(config);
    };

    const result = visitControlApi.getMe();
    await jest.advanceTimersByTimeAsync(499);
    expect(requests).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ id: 'synthetic-user' });
    expect(requests).toHaveLength(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('gives the retry only the remaining overall budget after a timeout', async () => {
    client.defaults.adapter = config => {
      requests.push(config);
      if (requests.length === 2) return Promise.resolve(response(config));
      return new Promise((_, reject) => setTimeout(
        () => reject(new AxiosError('Timed out', 'ECONNABORTED', config, {})), config.timeout,
      ));
    };

    const result = visitControlApi.getMe();
    await jest.advanceTimersByTimeAsync(4_500);
    expect(await result).toMatchObject({ id: 'synthetic-user' });
    expect(requests.map(config => config.timeout)).toEqual([4_000, 3_500]);
    expect(getAuthToken()).toBe('synthetic-token');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('finishes after eight seconds even when the transport ignores its timeout and abort', async () => {
    client.defaults.adapter = config => {
      requests.push(config);
      return new Promise(() => {});
    };
    const settled = jest.fn();
    const result = visitControlApi.getMe().then(settled, error => { settled(error); return error; });

    await jest.advanceTimersByTimeAsync(7_999);
    expect(settled).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(await result).toBeInstanceOf(ApiError);
    expect(await result).toMatchObject({ isTimeoutError: true });
    expect(requests).toHaveLength(1);
    expect(requests[0].signal?.aborted).toBe(true);
    expect(getAuthToken()).toBe('synthetic-token');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not accept a profile that arrives after the deadline', async () => {
    let complete!: () => void;
    client.defaults.adapter = config => new Promise(resolve => {
      complete = () => resolve(response(config));
    });
    const accepted = jest.fn();
    const result = visitControlApi.getMe().then(accepted, error => error);

    await jest.advanceTimersByTimeAsync(8_000);
    expect(await result).toMatchObject({ isTimeoutError: true });
    complete();
    await jest.advanceTimersByTimeAsync(0);
    expect(accepted).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects a late success even when the overdue deadline timer has not run', async () => {
    let complete!: () => void;
    client.defaults.adapter = config => new Promise(resolve => {
      requests.push(config);
      complete = () => resolve(response(config));
    });
    const result = visitControlApi.getMe().catch(error => error);
    await jest.advanceTimersByTimeAsync(0);
    expect(requests).toHaveLength(1);

    // JS resumes with a response microtask queued ahead of the overdue timer.
    jest.setSystemTime(Date.now() + 8_050);
    complete();

    expect(await result).toBeInstanceOf(ApiError);
    expect(await result).toMatchObject({ isTimeoutError: true });
    expect(requests[0].signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels a pending retry delay at the overall deadline', async () => {
    client.defaults.adapter = config => {
      requests.push(config);
      return new Promise((_, reject) => setTimeout(() => reject(failure(config)), 7_800));
    };
    const result = visitControlApi.getMe().catch(error => error);

    await jest.advanceTimersByTimeAsync(8_000);
    expect(await result).toMatchObject({ isTimeoutError: true });
    expect(requests).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(requests).toHaveLength(1);
  });

  it('stops after the second temporary failure', async () => {
    client.defaults.adapter = async config => {
      requests.push(config);
      throw failure(config, 503);
    };
    const result = visitControlApi.getMe().catch(error => error);

    await jest.advanceTimersByTimeAsync(500);
    expect(await result).toMatchObject({ status: 503 });
    await jest.advanceTimersByTimeAsync(30_000);
    expect(requests).toHaveLength(2);
    expect(getAuthToken()).toBe('synthetic-token');
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([401, 403])('does not retry an access rejection (%s)', async status => {
    const expired = jest.fn();
    setUnauthorizedHandler(expired);
    client.defaults.adapter = async config => {
      requests.push(config);
      throw failure(config, status);
    };

    await expect(visitControlApi.getMe()).rejects.toMatchObject({ status });
    await jest.advanceTimersByTimeAsync(30_000);
    expect(requests).toHaveLength(1);
    expect(expired).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps the existing timeout for other API requests', async () => {
    client.defaults.adapter = async config => { requests.push(config); return response(config); };

    await visitControlApi.get('/organization/current', { skipLogging: true });
    expect(requests[0].timeout).toBe(10_000);
    expect(requests[0].signal).toBeUndefined();
  });
});
