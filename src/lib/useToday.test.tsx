import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useToday } from './useToday';

afterEach(() => vi.useRealTimers());

describe('useToday', () => {
  it('a page left open over midnight moves to the new site day within a minute', () => {
    vi.useFakeTimers({ now: new Date('2026-10-14T16:59:50Z') }); // 23:59:50 WIB
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2026-10-14');
    act(() => vi.advanceTimersByTime(70_000));
    expect(result.current).toBe('2026-10-15');
  });
});
