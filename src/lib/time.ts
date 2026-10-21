// Every time on screen is in the site's time zone, whatever the browser's. SiteZoneGate sets it from site settings
// once after login; Asia/Jakarta until then (and in tests).
let zone = 'Asia/Jakarta';

const DAY_MS = 86_400_000;

// Built on first use for the current zone, remade when the zone changes.
let fmts: { zone: string; parts: Intl.DateTimeFormat; offset: Intl.DateTimeFormat } | null = null;

function formats() {
  if (fmts?.zone !== zone) {
    fmts = {
      zone,
      parts: new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }),
      offset: new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }),
    };
  }
  return fmts;
}

export function setSiteTimeZone(tz: string): void {
  zone = tz;
}

export function siteTimeZone(): string {
  return zone;
}

const ZONE_LABELS: Record<string, string> = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };

export function siteZoneLabel(): string {
  return (
    ZONE_LABELS[zone] ??
    new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ??
    zone
  );
}

function local(d: Date): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string> {
  const p = Object.fromEntries(formats().parts.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

// 'GMT+07:00' → '+07:00'; plain 'GMT' is UTC.
function offsetAt(d: Date): string {
  const name = formats().offset.formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
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
