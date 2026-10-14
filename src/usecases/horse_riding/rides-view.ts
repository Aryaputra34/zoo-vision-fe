import type { EventStatsRowDto } from '@/api/generated/zooVisionAPI.schemas';
import { fillBuckets } from '@/lib/buckets';
import { localDate, localDayRange, localHour } from '@/lib/time';
import { operatingHours } from '@/lib/util';

export type EventStatsRow = EventStatsRowDto;

// The rows come grouped by this field, as requested.
export const DIRECTION = 'data.direction';

type Counts = { bucketStart: string; departures: number; returns: number };

function countsPerBucket(rows: EventStatsRow[], from: string, to: string, bucket: 'hour' | 'day'): Counts[] {
  const filled = fillBuckets<EventStatsRow>(rows, from, to, bucket, (bucketStart) => ({ bucketStart, group: {}, count: 0 }));
  const out = new Map<number, Counts>();
  for (const r of filled) {
    const t = Date.parse(r.bucketStart);
    const c = out.get(t) ?? { bucketStart: r.bucketStart, departures: 0, returns: 0 };
    const dir = r.group[DIRECTION];
    if (dir === 'DEPARTURE') c.departures += r.count;
    else if (dir === 'RETURN') c.returns += r.count;
    out.set(t, c);
  }
  return [...out.values()];
}

export function ridesView(
  hourRows: EventStatsRow[],
  dayRows: EventStatsRow[],
  date: string,
  from14: string,
  to: string,
): {
  departures: number;
  returns: number;
  onTrack: number;
  busiestHour: string | null;
  hourly: { hour: string; departures: number; returns: number }[];
  days: { date: string; departures: number; returns: number }[];
} {
  const day = localDayRange(date);
  const allHours = countsPerBucket(hourRows, day.from, day.to, 'hour').map((c) => ({
    hour: localHour(c.bucketStart),
    departures: c.departures,
    returns: c.returns,
  }));
  const departures = allHours.reduce((s, h) => s + h.departures, 0);
  const returns = allHours.reduce((s, h) => s + h.returns, 0);
  const busiest = allHours.reduce((b, h) => (h.departures > b.departures ? h : b), allHours[0]);

  return {
    departures,
    returns,
    onTrack: Math.max(0, departures - returns),
    busiestHour: busiest && busiest.departures > 0 ? busiest.hour : null,
    hourly: operatingHours(allHours, (h) => !h.departures && !h.returns),
    days: countsPerBucket(dayRows, from14, to, 'day')
      .map((c) => ({ date: localDate(c.bucketStart), departures: c.departures, returns: c.returns }))
      .reverse(),
  };
}
