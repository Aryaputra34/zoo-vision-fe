import { describe, it, expect } from 'vitest';
import type { EventStatsRowDto } from '@/api/generated/zooVisionAPI.schemas';
import { localDaysRange } from '@/lib/time';
import { ridesView } from './rides-view';

const row = (bucketStart: string, direction: string | null, count: number): EventStatsRowDto => ({
  bucketStart,
  group: { 'data.direction': direction },
  count,
});
const DATE = '2026-10-14';
const { from: from14, to } = localDaysRange(DATE, 14);

describe('ridesView', () => {
  it('3 departures and 2 returns → onTrack 1; busiestHour is the hour with most departures; null when none', () => {
    const hours = [
      row('2026-10-14T01:00:00.000Z', 'DEPARTURE', 1), // 08 WIB
      row('2026-10-14T03:00:00.000Z', 'DEPARTURE', 2), // 10 WIB
      row('2026-10-14T03:00:00.000Z', 'RETURN', 2),
    ];
    const v = ridesView(hours, [], DATE, from14, to);
    expect(v).toMatchObject({ departures: 3, returns: 2, onTrack: 1, busiestHour: '10' });
    expect(v.hourly.map((h) => h.hour)).toEqual(['08', '09', '10', '11', '12', '13', '14', '15', '16', '17']);
    expect(v.hourly[2]).toEqual({ hour: '10', departures: 2, returns: 2 });

    const none = ridesView([], [], DATE, from14, to);
    expect(none).toMatchObject({ departures: 0, returns: 0, onTrack: 0, busiestHour: null });
    expect(none.hourly).toHaveLength(10);
  });

  it('more returns than departures never shows a negative number on the track', () => {
    const v = ridesView([row('2026-10-14T01:00:00.000Z', 'RETURN', 2)], [], DATE, from14, to);
    expect(v.onTrack).toBe(0);
  });

  it('activity outside 08–17 widens the hourly range', () => {
    const v = ridesView([row('2026-10-13T23:00:00.000Z', 'DEPARTURE', 1)], [], DATE, from14, to); // 06 WIB
    expect(v.hourly[0].hour).toBe('06');
    expect(v.hourly.at(-1)?.hour).toBe('17');
  });

  it('days has 14 rows, newest first, filled with zeros', () => {
    const days = [
      row('2026-10-11T17:00:00.000Z', 'DEPARTURE', 4), // 2026-10-12
      row('2026-10-11T17:00:00.000Z', 'RETURN', 3),
    ];
    const v = ridesView([], days, DATE, from14, to);
    expect(v.days).toHaveLength(14);
    expect(v.days[0]).toEqual({ date: '2026-10-14', departures: 0, returns: 0 });
    expect(v.days[2]).toEqual({ date: '2026-10-12', departures: 4, returns: 3 });
    expect(v.days[13].date).toBe('2026-10-01');
  });
});
