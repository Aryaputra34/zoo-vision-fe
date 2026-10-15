import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { onUnauthenticated } from '@/api/http';

type Handler = (...args: unknown[]) => void;

class FakeSocket {
  handlers = new Map<string, Set<Handler>>();
  emitted: { event: string; payload: unknown }[] = [];
  connected = false;
  active = false;
  connect = vi.fn(() => {
    this.active = true;
    return this;
  });
  disconnect = vi.fn(() => {
    this.active = false;
    this.connected = false;
    return this;
  });
  on(event: string, fn: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return this;
  }
  off(event: string, fn: Handler) {
    this.handlers.get(event)?.delete(fn);
    return this;
  }
  removeAllListeners() {
    this.handlers.clear();
    return this;
  }
  emit(event: string, payload: unknown, ack?: (r: { ok: boolean }) => void) {
    this.emitted.push({ event, payload });
    ack?.({ ok: true });
    return this;
  }
  // Test drivers: what the server does.
  fire(event: string, ...args: unknown[]) {
    for (const fn of [...(this.handlers.get(event) ?? [])]) fn(...args);
  }
  serverConnect() {
    this.connected = true;
    this.active = true;
    this.fire('connect');
  }
  serverDisconnect(reason = 'transport close') {
    this.connected = false;
    this.fire('disconnect', reason);
  }
  count(event: string) {
    return this.emitted.filter((e) => e.event === event).length;
  }
}

const h = vi.hoisted(() => ({ socket: null as unknown }));
vi.mock('./socket', () => ({ createSocket: () => h.socket }));
vi.mock('@/auth/AuthProvider', () => ({
  useMe: () => ({ me: { id: 'u1', username: 'demo-user', name: 'Demo', role: 'USER' }, isLoading: false }),
}));

import { LiveProvider } from './LiveProvider';
import { useStatus } from './useStatus';
import { isLiveDataKey } from './query-keys';

let socket: FakeSocket;
let client: QueryClient;

function wrap(children: ReactNode) {
  return (
    <QueryClientProvider client={client}>
      <LiveProvider>{children}</LiveProvider>
    </QueryClientProvider>
  );
}

function Queries({ fns }: { fns: Record<string, () => Promise<unknown>> }) {
  useQuery({ queryKey: ['/api/v1/reports/events/stats', { bucket: 'hour' }], queryFn: fns.reports });
  useQuery({ queryKey: ['/api/v1/events', { limit: 200 }], queryFn: fns.events });
  useQuery({ queryKey: ['/api/v1/auth/me'], queryFn: fns.me });
  useQuery({ queryKey: ['/api/v1/usecases'], queryFn: fns.usecases });
  return null;
}

function makeFns() {
  return {
    reports: vi.fn(async () => ({ rows: [] })),
    events: vi.fn(async () => ({ rows: [] })),
    me: vi.fn(async () => ({ id: 'u1' })),
    usecases: vi.fn(async () => []),
  };
}

beforeEach(() => {
  socket = new FakeSocket();
  h.socket = socket;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
});

afterEach(() => {
  vi.useRealTimers();
  client.clear();
});

describe('isLiveDataKey', () => {
  it('matches reports, lists and system log keys only', () => {
    expect(isLiveDataKey(['/api/v1/reports/events/stats', {}])).toBe(true);
    expect(isLiveDataKey(['/api/v1/events', {}])).toBe(true);
    expect(isLiveDataKey(['/api/v1/intervals'])).toBe(true);
    expect(isLiveDataKey(['/api/v1/system-log/audit'])).toBe(true);
    expect(isLiveDataKey(['/api/v1/auth/me'])).toBe(false);
    expect(isLiveDataKey(['/api/v1/usecases'])).toBe(false);
    expect(isLiveDataKey(['/api/v1/cameras'])).toBe(false);
  });
});

describe('LiveProvider', () => {
  it('data.changed refetches report and list queries but not authMe or usecasesList', async () => {
    const fns = makeFns();
    render(wrap(<Queries fns={fns} />));
    act(() => socket.serverConnect());
    await waitFor(() => expect(fns.usecases).toHaveBeenCalledTimes(1));

    act(() => socket.fire('data.changed', { cameraIds: ['c1'], useCases: ['horse_riding'], shapes: ['event'] }));

    await waitFor(() => expect(fns.reports).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fns.events).toHaveBeenCalledTimes(2));
    expect(fns.me).toHaveBeenCalledTimes(1);
    expect(fns.usecases).toHaveBeenCalledTimes(1);
  });

  it('a reconnect refetches every query', async () => {
    const fns = makeFns();
    render(wrap(<Queries fns={fns} />));
    act(() => socket.serverConnect());
    await waitFor(() => expect(fns.usecases).toHaveBeenCalledTimes(1));
    expect(fns.reports).toHaveBeenCalledTimes(1);

    act(() => socket.serverDisconnect());
    act(() => socket.serverConnect());

    await waitFor(() => expect(fns.usecases).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fns.me).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fns.reports).toHaveBeenCalledTimes(2));
  });

  it('session.ended logout calls the unauthenticated handler; role_changed refetches authMe and reconnects instead', async () => {
    const unauth = vi.fn();
    const off = onUnauthenticated(unauth);
    try {
      const fns = makeFns();
      render(wrap(<Queries fns={fns} />));
      act(() => socket.serverConnect());
      await waitFor(() => expect(fns.me).toHaveBeenCalledTimes(1));
      expect(socket.connect).toHaveBeenCalledTimes(1);

      act(() => socket.fire('session.ended', { reason: 'role_changed' }));
      await waitFor(() => expect(fns.me).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(socket.connect).toHaveBeenCalledTimes(2));
      expect(unauth).not.toHaveBeenCalled();

      act(() => socket.fire('session.ended', { reason: 'logout' }));
      expect(unauth).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  it('a refused handshake: UNAUTHENTICATED goes to login, UNAVAILABLE is retried after a growing delay', async () => {
    vi.useFakeTimers();
    const unauth = vi.fn();
    const off = onUnauthenticated(unauth);
    try {
      render(wrap(null));
      expect(socket.connect).toHaveBeenCalledTimes(1);

      socket.active = false; // socket.io gives up on a handshake the server refused
      act(() => socket.fire('connect_error', new Error('UNAVAILABLE')));
      act(() => vi.advanceTimersByTime(1_999));
      expect(socket.connect).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(1));
      expect(socket.connect).toHaveBeenCalledTimes(2);

      socket.active = false;
      act(() => socket.fire('connect_error', new Error('UNAVAILABLE')));
      act(() => vi.advanceTimersByTime(3_999));
      expect(socket.connect).toHaveBeenCalledTimes(2);
      act(() => vi.advanceTimersByTime(1));
      expect(socket.connect).toHaveBeenCalledTimes(3);

      socket.active = false;
      act(() => socket.fire('connect_error', new Error('UNAUTHENTICATED')));
      expect(unauth).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(60_000));
      expect(socket.connect).toHaveBeenCalledTimes(3);
    } finally {
      off();
    }
  });
});

function StatusProbe() {
  const { cameras, paused } = useStatus();
  return (
    <div>
      {paused ? 'paused' : 'live'} {Object.keys(cameras).length}
    </div>
  );
}

describe('useStatus', () => {
  it('two components using useStatus subscribe once; the room is left after both unmount', () => {
    function Toggle() {
      const [show, setShow] = useState(true);
      return (
        <>
          <button onClick={() => setShow(false)}>hide</button>
          {show && (
            <>
              <StatusProbe />
              <StatusProbe />
            </>
          )}
        </>
      );
    }
    render(wrap(<Toggle />));
    act(() => socket.serverConnect());
    expect(socket.count('subscribe')).toBe(1);
    expect(socket.emitted.find((e) => e.event === 'subscribe')?.payload).toEqual({ rooms: ['status'] });

    act(() => screen.getByText('hide').click());
    expect(socket.count('unsubscribe')).toBe(1);
  });

  it('subscribes again after a reconnect', () => {
    render(wrap(<StatusProbe />));
    act(() => socket.serverConnect());
    act(() => socket.serverDisconnect());
    act(() => socket.serverConnect());
    expect(socket.count('subscribe')).toBe(2);
  });

  it('useStatus is paused 10 s after the last snapshot and resumes on the next one', () => {
    vi.useFakeTimers();
    render(wrap(<StatusProbe />));
    act(() => socket.serverConnect());
    act(() => socket.fire('status.snapshot', { at: '2026-10-15T01:00:00.000Z', cameras: { c1: null, c2: null } }));
    expect(screen.getByText('live 2')).toBeTruthy();

    act(() => vi.advanceTimersByTime(9_999));
    expect(screen.getByText('live 2')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('paused 2')).toBeTruthy();

    act(() => socket.fire('status.snapshot', { at: '2026-10-15T01:00:12.000Z', cameras: { c1: null } }));
    expect(screen.getByText('live 1')).toBeTruthy();
  });
});
