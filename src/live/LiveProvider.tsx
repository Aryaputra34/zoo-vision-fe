"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notifyUnauthenticated } from '@/api/http';
import { getAuthMeQueryKey } from '@/api/generated/auth/auth';
import { useMe } from '@/auth/AuthProvider';
import type { AuditNotice, CameraStatus, EventCreated, StatusSnapshot } from '@/contract/web';
import { createSocket, type LiveSocket } from './socket';
import { isLiveDataKey } from './query-keys';

const PAUSED_AFTER_MS = 10_000;
const RETRY_FIRST_MS = 2_000;
const RETRY_MAX_MS = 30_000;

export type StatusState = { cameras: Record<string, CameraStatus | null>; paused: boolean };
const EMPTY: StatusState = { cameras: {}, paused: false };

// The status room, joined while at least one component uses it. Lives as long as the provider; the socket
// attaches while logged in.
export class StatusStore {
  private state: StatusState = EMPTY;
  private listeners = new Set<() => void>();
  private refs = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private socket: LiveSocket | null = null;

  get = (): StatusState => this.state;

  listen = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  acquire(): () => void {
    if (this.refs++ === 0 && this.socket) {
      this.join();
      this.armWatchdog();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--this.refs === 0) {
        clearTimeout(this.timer);
        if (this.socket?.connected) this.socket.emit('unsubscribe', { rooms: ['status'] }, ackLogger('unsubscribe'));
        this.set(EMPTY);
      }
    };
  }

  // Room membership does not survive a reconnect.
  onConnect(): void {
    if (this.refs > 0) this.join();
  }

  onSnapshot(snapshot: StatusSnapshot): void {
    if (this.refs === 0) return;
    this.armWatchdog();
    this.set({ cameras: snapshot.cameras, paused: false });
  }

  attach(socket: LiveSocket): void {
    this.socket = socket;
    if (this.refs > 0) this.armWatchdog();
  }

  detach(): void {
    this.socket = null;
    clearTimeout(this.timer);
    this.set(EMPTY);
  }

  private join(): void {
    if (this.socket?.connected) this.socket.emit('subscribe', { rooms: ['status'] }, ackLogger('subscribe'));
  }

  private armWatchdog(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.set({ ...this.state, paused: true }), PAUSED_AFTER_MS);
  }

  private set(next: StatusState): void {
    this.state = next;
    for (const fn of this.listeners) fn();
  }
}

function ackLogger(what: string) {
  return (r: { ok: boolean; code?: string }) => {
    if (!r.ok) console.error(`Live ${what} refused: ${r.code}`);
  };
}

type LiveContextValue = {
  status: StatusStore | null;
  onEvent: (fn: (e: EventCreated) => void) => () => void;
  onAudit: (fn: (n: AuditNotice) => void) => () => void;
};

const noop = () => () => {};
const LiveContext = createContext<LiveContextValue>({ status: null, onEvent: noop, onAudit: noop });

export function useLiveContext(): LiveContextValue {
  return useContext(LiveContext);
}

// One socket per tab while logged in. REST stays the source of truth: the socket only says what to refetch.
export function LiveProvider({ children }: { children: ReactNode }): ReactNode {
  const { me } = useMe();
  const loggedIn = !!me;
  const queryClient = useQueryClient();
  const [status] = useState(() => new StatusStore());
  const eventFns = useRef(new Set<(e: EventCreated) => void>());
  const auditFns = useRef(new Set<(n: AuditNotice) => void>());

  useEffect(() => {
    if (!loggedIn) return;
    const socket = createSocket();
    const store = status;
    store.attach(socket);
    let connectedBefore = false;
    let retryDelay = RETRY_FIRST_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    socket.on('connect', () => {
      retryDelay = RETRY_FIRST_MS;
      store.onConnect();
      // No replay: whatever happened while disconnected is only in REST.
      if (connectedBefore) void queryClient.invalidateQueries();
      connectedBefore = true;
    });

    socket.on('connect_error', (err) => {
      if (err.message === 'UNAUTHENTICATED') {
        notifyUnauthenticated();
        return;
      }
      if (err.message === 'FORBIDDEN_ORIGIN') {
        console.error('Live socket refused with FORBIDDEN_ORIGIN: the page is not served from the API host');
        return;
      }
      // socket.io retries a lost connection itself, but never a handshake the server refused (UNAVAILABLE).
      if (socket.active) return;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (!stopped) socket.connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    });

    socket.on('data.changed', () => {
      void queryClient.invalidateQueries({ predicate: (q) => isLiveDataKey(q.queryKey) });
    });
    socket.on('status.snapshot', (s) => store.onSnapshot(s));
    socket.on('event.created', (e) => eventFns.current.forEach((fn) => fn(e)));
    socket.on('audit.notice', (n) => auditFns.current.forEach((fn) => fn(n)));

    socket.on('session.ended', ({ reason }) => {
      socket.disconnect();
      if (reason === 'role_changed') {
        // The session is still valid: pick up the new role, then rejoin the rooms that role gets.
        void queryClient.refetchQueries({ queryKey: getAuthMeQueryKey() }).finally(() => {
          if (!stopped) socket.connect();
        });
        return;
      }
      notifyUnauthenticated();
    });

    socket.connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      store.detach();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [loggedIn, queryClient, status]);

  const value = useMemo<LiveContextValue>(
    () => ({
      status,
      onEvent: (fn) => {
        eventFns.current.add(fn);
        return () => eventFns.current.delete(fn);
      },
      onAudit: (fn) => {
        auditFns.current.add(fn);
        return () => auditFns.current.delete(fn);
      },
    }),
    [status],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
