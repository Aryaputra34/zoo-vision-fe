import { localDate, localDayRange } from './time';

const HOUR_MS = 3_600_000;

function nextBucket(t: number, bucket: 'hour' | 'day'): number {
  if (bucket === 'hour') return t + HOUR_MS;
  return Date.parse(localDayRange(localDate(new Date(t).toISOString())).to);
}

// Report rows are sparse: the API sends only buckets that have data. This gives every bucket in [from, to),
// in order, keeping all rows of a bucket (one per group) and adding empty(bucketStart) where there were none.
export function fillBuckets<R extends { bucketStart: string }>(
  rows: R[],
  from: string,
  to: string,
  bucket: 'hour' | 'day',
  empty: (bucketStart: string) => R,
): R[] {
  const byStart = new Map<number, R[]>();
  for (const r of rows) {
    const t = Date.parse(r.bucketStart);
    const list = byStart.get(t);
    if (list) list.push(r);
    else byStart.set(t, [r]);
  }
  const out: R[] = [];
  const end = Date.parse(to);
  for (let t = Date.parse(from); t < end; t = nextBucket(t, bucket)) {
    out.push(...(byStart.get(t) ?? [empty(new Date(t).toISOString())]));
  }
  return out;
}
