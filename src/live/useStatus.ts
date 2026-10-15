"use client";

import { useEffect, useSyncExternalStore } from 'react';
import { useLiveContext, type StatusState } from './LiveProvider';

const EMPTY: StatusState = { cameras: {}, paused: false };
const getEmpty = () => EMPTY;
const listenNothing = () => () => {};

// Every camera's status from the status room; null is an offline camera. `paused` means no snapshot for 10 s.
export function useStatus(): StatusState {
  const { status } = useLiveContext();
  useEffect(() => status?.acquire(), [status]);
  return useSyncExternalStore(status?.listen ?? listenNothing, status?.get ?? getEmpty, getEmpty);
}
