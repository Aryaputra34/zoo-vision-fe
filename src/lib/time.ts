// Every time on screen is in the site's time zone, whatever the browser's. Site settings replace this in Phase 4.
export const SITE_TZ = 'Asia/Jakarta';

const DAY_MS = 86_400_000;

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SITE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const offsetFmt = new Intl.DateTimeFormat('en-US', { timeZone: SITE_TZ, timeZoneName: 'longOffset' });

function local(d: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string> {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

// 'GMT+07:00' → '+07:00'; plain 'GMT' is UTC.
function offsetAt(d: Date): string {
  const name = offsetFmt.formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  return name === 'GMT' ? '+00:00' : name.slice(3);
}

// Calendar arithmetic on 'YYYY-MM-DD', independent of any time zone.
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function todayLocal(now: Date = new Date()): string {
  const p = local(now);
  return `${p.year}-${p.month}-${p.day}`;
}

export function localDate(iso: string): string {
  return todayLocal(new Date(iso));
}

const midnight = (date: string) => `${date}T00:00:00${offsetAt(new Date(`${date}T12:00:00Z`))}`;

// [00:00, next day 00:00) local, as ISO with the offset: what the report endpoints take as from/to.
export function localDayRange(date: string): { from: string; to: string } {
  return { from: midnight(date), to: midnight(addDays(date, 1)) };
}

export function localDaysRange(lastDate: string, days: number): { from: string; to: string } {
  return { from: midnight(addDays(lastDate, -(days - 1))), to: midnight(addDays(lastDate, 1)) };
}

export function fmtLocalTime(iso: string): string {
  const p = local(new Date(iso));
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function localHour(iso: string): string {
  return local(new Date(iso)).hour;
}

export function isDateParam(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}
