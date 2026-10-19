"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NAV } from "./nav";

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:overflow-visible">
      {NAV.map(({ href, label, Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              active ? "bg-lime text-forest" : "text-side-ink-2 hover:bg-white/10 hover:text-side-ink"
            }`}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// Day picker that keeps the other query params (filters) in the URL.
export function DatePicker({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const href = (d: string) => {
    const p = new URLSearchParams(sp);
    if (d === today) p.delete("date");
    else p.set("date", d);
    const qs = p.toString();
    return qs ? `${path}?${qs}` : path;
  };
  const btn = "grid size-9 place-items-center rounded-full border border-line bg-surface text-forest hover:bg-lime/20 hover:border-lime/60 shadow-sm transition-colors";
  return (
    <div className="flex items-center gap-1.5">
      <Link href={href(addDays(date, -1))} className={btn} aria-label="Previous day">
        <ChevronLeft aria-hidden className="size-4" />
      </Link>
      <input
        type="date"
        aria-label="Date"
        value={date}
        max={today}
        onChange={(e) => e.target.value && router.push(href(e.target.value))}
        className="h-9 rounded-full border border-line bg-surface px-3 text-xs font-extrabold text-forest shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
      />
      {date < today ? (
        <Link href={href(addDays(date, 1))} className={btn} aria-label="Next day">
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span className={`${btn} opacity-40 cursor-not-allowed`} aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
      {date !== today && (
        <Link
          href={href(today)}
          className="h-9 rounded-full bg-forest text-lime px-4 text-xs leading-9 font-extrabold shadow-sm hover:bg-forest-dark transition-colors"
        >
          Today · Hari Ini
        </Link>
      )}
    </div>
  );
}

const axis = { fontSize: 11, fill: "var(--muted)", fontWeight: 600 };
const tooltipStyle = {
  contentStyle: {
    background: "#0d542e",
    border: "1px solid rgba(130, 187, 58, 0.4)",
    borderRadius: 14,
    fontSize: 12,
    color: "#ffffff",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
    padding: "8px 12px",
  },
  labelStyle: { color: "#82bb3a", fontWeight: "bold", marginBottom: "4px" },
  itemStyle: { color: "#ffffff", fontSize: "11px", fontWeight: "bold" },
  cursor: { fill: "rgba(130, 187, 58, 0.08)" },
};

function Legend({ series }: { series: { label: string; color: string }[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-4 text-xs font-extrabold text-forest">
      {series.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 border border-line">
          <span className="size-2.5 rounded-full shadow-sm" style={{ background: s.color }} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

// Fixed categorical order with official Taman Safari brand colors
const SERIES_COLORS = ["#0d542e", "#82bb3a", "#f5a623", "#2080c4"];

export function HourlyBars({
  data,
  series,
  unit = "",
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string }[];
  unit?: string;
}) {
  const s = series.map((x, i) => ({ ...x, color: SERIES_COLORS[i % SERIES_COLORS.length] }));
  return (
    <div>
      <Legend series={s} />
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 256 }}>
          <BarChart data={data} barGap={3} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="hour"
              tick={axis}
              tickLine={false}
              axisLine={{ stroke: "var(--axis)" }}
              tickFormatter={(h) => `${h}:00`}
            />
            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={(h) => `${h}:00–${h}:59 WIB`}
              formatter={(v) => `${Math.round(Number(v) * 10) / 10}${unit}`}
            />
            {s.map((x) => (
              <Bar
                key={x.key}
                dataKey={x.key}
                name={x.label}
                fill={x.color}
                maxBarSize={28}
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function OccupancyChart({
  data,
  warning,
  max,
}: {
  data: { time: string; occupancy: number }[];
  warning: number;
  max: number;
}) {
  const top = Math.max(max, ...data.map((d) => d.occupancy)) + 5;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 256 }}>
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="safariGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#82bb3a" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#0d542e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={axis} tickLine={false} axisLine={{ stroke: "var(--axis)" }} minTickGap={32} />
          <YAxis tick={axis} tickLine={false} axisLine={false} domain={[0, top]} allowDecimals={false} />
          <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--axis)" }} labelFormatter={(t) => `${t} WIB (5-min peak)`} />
          <ReferenceLine
            y={warning}
            stroke="#f5a623"
            strokeDasharray="4 4"
            label={{ value: `Warning ${warning}`, position: "insideTopLeft", fontSize: 11, fill: "#f5a623", fontWeight: 700 }}
          />
          <ReferenceLine
            y={max}
            stroke="#d9383a"
            strokeDasharray="4 4"
            label={{ value: `Max Limit ${max}`, position: "insideTopLeft", fontSize: 11, fill: "#d9383a", fontWeight: 700 }}
          />
          <Area
            type="monotone"
            dataKey="occupancy"
            name="Dining Guests"
            stroke="#0d542e"
            strokeWidth={3}
            fill="url(#safariGradient)"
            dot={false}
            activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2, fill: "#82bb3a" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
