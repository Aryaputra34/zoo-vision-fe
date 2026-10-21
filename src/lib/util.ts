import { fmtLocalTime, localDate, localDayRange, localHour, todayLocal } from "./time";

const DAY = 86_400_000;

// All in the site time zone (src/lib/time.ts); the names are older than the zone setting.
const iso = (ts: number) => new Date(ts).toISOString();
export const todayWib = () => todayLocal();
export const fmtTime = (ts: number) => fmtLocalTime(iso(ts));
export const fmtHm = (ts: number) => fmtTime(ts).slice(0, 5);
export const fmtDateTime = (ts: number) => `${dayOf(ts)} ${fmtTime(ts)}`;
export const dayOf = (ts: number) => localDate(iso(ts));
export const hourOf = (ts: number) => localHour(iso(ts));

export function dayRange(date: string): [number, number] {
  const { from, to } = localDayRange(date);
  return [Date.parse(from), Date.parse(to) - 1];
}

export const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function dateParam(v: string | string[] | undefined) {
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : todayWib();
}

export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

// Trim leading/trailing empty hours so the chart focuses on operating hours (keeps 08–17 at least).
export function operatingHours<T extends { hour: string }>(rows: T[], isEmpty: (r: T) => boolean) {
  let a = rows.findIndex((r) => !isEmpty(r));
  let b = rows.findLastIndex((r) => !isEmpty(r));
  if (a < 0) [a, b] = [8, 17];
  return rows.slice(Math.min(a, 8), Math.max(b, 17) + 1);
}

export const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
export const fmtNum = (n: number) => n.toLocaleString("en-US");
export const fmtMin = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${Math.round(min % 60)}m` : `${Math.round(min)}m`);

export const USE_CASES: Record<string, string> = {
  vehicle_gate: "Vehicle gate",
  cashier_presence: "Cashier",
  restaurant_counter: "Restaurant",
  restaurant_table: "Restaurant tables",
  horse_riding: "Pony rides",
};

export const EVENT_TYPES: Record<string, string> = {
  vehicle_crossing: "Vehicle crossing",
  cashier_unattended: "Desk unattended",
  customer_waiting: "Customer waiting",
  capacity_alert: "Capacity alert",
  table_state_change: "Table seated / vacated",
  horse_crossing: "Pony crossing",
  status: "Status (heartbeat)",
};
