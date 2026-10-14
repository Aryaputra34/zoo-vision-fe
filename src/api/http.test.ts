import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, apiFetch, ApiError, onUnauthenticated, backendHealth } from './http';
import { InternalAxiosRequestConfig, AxiosResponse, AxiosError, AxiosHeaders } from 'axios';

describe('http and ApiError handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('a 409 {statusCode, code: "STALE_VERSION", message} rejects with ApiError code STALE_VERSION', async () => {
    http.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      const response: AxiosResponse = {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config,
        data: { statusCode: 409, code: 'STALE_VERSION', message: 'Version mismatch' },
      };
      const error = new AxiosError('Request failed with status code 409', '409', config, null, response);
      throw error;
    };

    await expect(apiFetch({ url: '/test' })).rejects.toThrow(ApiError);
    try {
      await apiFetch({ url: '/test' });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.statusCode).toBe(409);
      expect(apiErr.code).toBe('STALE_VERSION');
      expect(apiErr.message).toBe('Version mismatch');
    }
  });

  it('a body without code → ApiError code UNKNOWN with the status', async () => {
    http.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      const response: AxiosResponse = {
        status: 502,
        statusText: 'Bad Gateway',
        headers: {},
        config,
        data: '<html>Bad Gateway</html>',
      };
      const error = new AxiosError('Server error', '502', config, null, response);
      throw error;
    };

    try {
      await apiFetch({ url: '/test-502' });
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.statusCode).toBe(502);
      expect(apiErr.code).toBe('UNKNOWN');
    }
  });

  it('a network failure → ApiError statusCode 0, code NETWORK; backendHealth reports down, then up after a success', async () => {
    const healthChanges: boolean[] = [];
    const unsubscribe = backendHealth.subscribe((down) => healthChanges.push(down));

    http.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      const error = new AxiosError('Network Error', undefined, config, null, undefined);
      throw error;
    };

    try {
      await apiFetch({ url: '/test-network' });
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.statusCode).toBe(0);
      expect(apiErr.code).toBe('NETWORK');
    }

    expect(backendHealth.down()).toBe(true);

    // Now simulate success
    http.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      return {
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
        data: { ok: true },
      };
    };

    const res = await apiFetch<{ ok: boolean }>({ url: '/test-ok' });
    expect(res).toEqual({ ok: true });
    expect(backendHealth.down()).toBe(false);

    unsubscribe();
  });

  it('a 401 calls the onUnauthenticated handler once', async () => {
    const handler = vi.fn();
    const unsubscribe = onUnauthenticated(handler);

    http.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      const response: AxiosResponse = {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
        data: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Session expired' },
      };
      const error = new AxiosError('Unauthorized', '401', config, null, response);
      throw error;
    };

    try {
      await apiFetch({ url: '/test-401' });
    } catch {
      // expected
    }

    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
