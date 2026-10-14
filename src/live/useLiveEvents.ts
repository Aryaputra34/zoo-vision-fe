"use client";

import { useEffect, useRef } from 'react';
import type { AuditNotice, EventCreated } from '@/contract/web';
import { useLiveContext } from './LiveProvider';

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

// For alerts (a toast, the bell). Tables refetch on data.changed instead.
export function useLiveEvents(handler: (e: EventCreated) => void): void {
  const { onEvent } = useLiveContext();
  const latest = useLatest(handler);
  useEffect(() => onEvent((e) => latest.current(e)), [onEvent, latest]);
}

// MANAGER and SUPERADMIN only: a camera with auditCamera set was changed.
export function useAuditNotices(handler: (n: AuditNotice) => void): void {
  const { onAudit } = useLiveContext();
  const latest = useLatest(handler);
  useEffect(() => onAudit((n) => latest.current(n)), [onAudit, latest]);
}
