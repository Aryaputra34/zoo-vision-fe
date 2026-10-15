import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { http } from '@/api/http';

const h = vi.hoisted(() => ({ created: 0 }));
vi.mock('@/live/socket', () => ({
  createSocket: () => {
    h.created++;
    const s = { connected: false, active: false, on: () => s, off: () => s, emit: () => s, connect: () => s, disconnect: () => s, removeAllListeners: () => s };
    return s;
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/rides',
}));

import { AuthProvider } from './AuthProvider';
import { LiveProvider } from '@/live/LiveProvider';

describe('AuthProvider', () => {
  it('authMe failing once with 502 (API restarting) is retried, so the live socket still starts', async () => {
    let calls = 0;
    http.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      calls++;
      if (calls === 1) {
        const response = { status: 502, statusText: 'Bad Gateway', headers: {}, config, data: '' };
        throw new AxiosError('Bad Gateway', '502', config, null, response);
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
        data: { id: 'u1', username: 'demo-user', name: 'Demo', role: 'USER' },
      };
    };
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <LiveProvider>
            <div />
          </LiveProvider>
        </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(h.created).toBe(1), { timeout: 4_000 });
    expect(calls).toBe(2);
  });
});
