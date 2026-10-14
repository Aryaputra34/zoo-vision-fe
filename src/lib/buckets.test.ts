import { describe, it, expect } from 'vitest';
import { fillBuckets } from './buckets';
import { localDayRange, localDaysRange } from './time';

type Row = { bucketStart: string; count: number; tag?: string };
const empty = (bucketStart: string): Row => ({ bucketStart, count: 0 });

describe('fillBuckets', () => {
  it('fillBuckets gives 24 hour rows for a day, zeros where the API sent none, in order', () => {
    const { from, to } = localDayRange('2026-10-14');
    const rows = [{ bucketStart: '2026-10-14T03:00:00.000Z', count: 5 }]; // 10:00 WIB
    const out = fillBuckets(rows, from, to, 'hour', empty);
    expect(out).toHaveLength(24);
    expect(out[0].bucketStart).toBe('2026-10-13T17:00:00.000Z');
    expect(out[23].bucketStart).toBe('2026-10-14T16:00:00.000Z');
    expect(out[10]).toEqual({ bucketStart: '2026-10-14T03:00:00.000Z', count: 5 });
    expect(out.reduce((s, r) => s + r.count, 0)).toBe(5);
  });

  it('day buckets start at local midnight; a bucket with several group rows keeps them all', () => {
    const { from, to } = localDaysRange('2026-10-14', 3);
    const rows: Row[] = [
      { bucketStart: '2026-10-13T17:00:00Z', count: 2, tag: 'a' },
      { bucketStart: '2026-10-13T17:00:00.000Z', count: 3, tag: 'b' },
    ];
    const out = fillBuckets(rows, from, to, 'day', empty);
    expect(out.map((r) => r.bucketStart)).toEqual([
      '2026-10-11T17:00:00.000Z',
      '2026-10-12T17:00:00.000Z',
      '2026-10-13T17:00:00Z',
      '2026-10-13T17:00:00.000Z',
    ]);
  });
});
