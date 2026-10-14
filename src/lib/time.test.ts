import { describe, it, expect } from 'vitest';
import { fmtLocalTime, localDate, localDayRange, localDaysRange, localHour, todayLocal } from './time';

describe('time in the site time zone', () => {
  it('localDayRange("2026-10-14") = {from: "2026-10-14T00:00:00+07:00", to: "2026-10-15T00:00:00+07:00"}', () => {
    expect(localDayRange('2026-10-14')).toEqual({ from: '2026-10-14T00:00:00+07:00', to: '2026-10-15T00:00:00+07:00' });
  });

  it('localDaysRange covers the last N local days up to the end of lastDate, across a month edge', () => {
    expect(localDaysRange('2026-10-14', 14)).toEqual({ from: '2026-10-01T00:00:00+07:00', to: '2026-10-15T00:00:00+07:00' });
    expect(localDaysRange('2026-10-01', 2)).toEqual({ from: '2026-09-30T00:00:00+07:00', to: '2026-10-02T00:00:00+07:00' });
  });

  it('localHour("2026-10-13T23:30:00.000Z") = "06"', () => {
    expect(localHour('2026-10-13T23:30:00.000Z')).toBe('06');
    expect(localHour('2026-10-13T17:00:00.000Z')).toBe('00');
  });

  it('todayLocal and localDate use the site day, not the UTC day', () => {
    expect(todayLocal(new Date('2026-10-14T17:30:00Z'))).toBe('2026-10-15');
    expect(todayLocal(new Date('2026-10-14T16:59:59Z'))).toBe('2026-10-14');
    expect(localDate('2026-10-13T17:00:00.000Z')).toBe('2026-10-14');
  });

  it('fmtLocalTime gives HH:mm:ss in the site time zone', () => {
    expect(fmtLocalTime('2026-10-14T01:02:03.000Z')).toBe('08:02:03');
    expect(fmtLocalTime('2026-10-14T17:00:00.000Z')).toBe('00:00:00');
  });
});
