import type { ReactNode } from "react";
import Image from "next/image";
import {
  CircleCheck,
  CircleDot,
  Info,
  OctagonAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { todayWib } from "@/lib/util";
import { DatePicker } from "./client";

export function PageHeader({
  title,
  subtitle,
  date,
  tag,
  children,
}: {
  title: string;
  subtitle?: string;
  date?: string;
  tag?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 rounded-[24px] border border-line bg-surface p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {tag && (
            <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-lime/20 px-3 py-0.5 text-[11px] font-extrabold text-forest uppercase tracking-wider">
              <Sparkles className="size-3 text-forest" />
              {tag}
            </div>
          )}
          <h1 className="text-2xl font-black tracking-tight text-forest sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm font-semibold text-ink-2">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          {date && <DatePicker date={date} today={todayWib()} />}
        </div>
      </div>
    </header>
  );
}

export function SafariHeroBanner({
  date,
  onlineCams,
  totalEvents,
  todayVehicles,
}: {
  date: string;
  onlineCams: number;
  totalEvents: number;
  todayVehicles: number;
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-[24px] border border-lime/30 bg-forest-dark text-white shadow-xl">
      {/* Background Image with Gradient Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/taman_safari_hero.jpg"
          alt="Taman Safari Indonesia Panorama"
          fill
          className="object-cover object-center opacity-30 brightness-90 transition-transform duration-1000 hover:scale-102"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-forest-dark via-forest-dark/90 to-forest-dark/60" />
      </div>

      {/* Zebra decorative corner accent */}
      <div className="zebra absolute top-0 right-0 h-2 w-40 rounded-bl-full shadow-md" />

      {/* Content HUD */}
      <div className="relative z-10 flex flex-col justify-between gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-lime/40 bg-lime/20 px-3 py-0.5 text-[10px] font-black tracking-wider text-lime uppercase backdrop-blur-md">
            <span className="size-2 rounded-full bg-lime animate-ping" />
            Live AI Telemetry · Cisarua Bogor Hub
          </div>
          <h2 className="mt-1.5 text-xl font-black tracking-tight text-white sm:text-2xl lg:text-3xl">
            Pusat Kendali Operasional <span className="text-lime">AI Vision</span>
          </h2>
          <p className="mt-0.5 text-xs text-white/80 max-w-2xl leading-relaxed">
            Pemantauan real-time koridor Safari Journey, loket tiket, dining hall, dan encounter arena melalui kamera CCTV sensor berkecepatan tinggi.
          </p>
        </div>

        {/* Compact Telemetry Chips */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:shrink-0">
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-md">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-lime">
              Status Taman
            </div>
            <div className="mt-0.5 text-base font-black text-white">BUKA</div>
            <div className="text-[10px] text-white/70">08:30 – 17:00 WIB</div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-md">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-lime">
              Sensor CCTV
            </div>
            <div className="mt-0.5 text-base font-black text-white">
              {onlineCams}/4 Online
            </div>
            <div className="text-[10px] text-white/70">100% Health</div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-md">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-lime">
              Populasi Safari
            </div>
            <div className="mt-0.5 text-base font-black text-white">
              {todayVehicles.toLocaleString("id-ID")}
            </div>
            <div className="text-[10px] text-white/70">Unit di koridor</div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-md">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-lime">
              Log Hari Ini
            </div>
            <div className="mt-0.5 text-base font-black text-white">
              {totalEvents.toLocaleString("id-ID")}
            </div>
            <div className="text-[10px] text-white/70">{date}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProgressBar({
  value,
  max = 100,
  color = "bg-lime",
  className = "",
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-surface-2 p-0.5 ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function Tile({
  label,
  value,
  sub,
  icon,
  badge,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-line bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-lime/60 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-extrabold uppercase tracking-wider text-ink-2">
            {label}
          </div>
          {badge}
        </div>
        {icon && (
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime/30 to-lime/10 text-forest shadow-sm transition-transform group-hover:scale-105 [&_svg]:size-5 ring-1 ring-lime/20">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 text-3xl font-black tracking-tight text-forest">
        {value}
      </div>
      {sub && <div className="mt-1.5 text-xs font-semibold text-muted">{sub}</div>}
    </div>
  );
}

export const Tiles = ({ children }: { children: ReactNode }) => (
  <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">{children}</div>
);

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-[24px] border border-line bg-surface shadow-sm overflow-hidden ${className}`}
    >
      {/* Top subtle lime accent stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-forest via-lime to-forest opacity-80" />

      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 px-5 py-4 sm:px-6">
          <div>
            {title && (
              <h2 className="text-base font-black tracking-tight text-forest">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs font-semibold text-muted">{subtitle}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export type Tone = "good" | "warn" | "crit" | "off" | "info";
const TONE: Record<Tone, { Icon: typeof Info; cls: string; bg: string }> = {
  good: { Icon: CircleCheck, cls: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40" },
  warn: { Icon: TriangleAlert, cls: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40" },
  crit: { Icon: OctagonAlert, cls: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/40" },
  off: { Icon: CircleDot, cls: "text-zinc-600 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/40" },
  info: { Icon: Info, cls: "text-forest dark:text-lime", bg: "bg-lime/15 dark:bg-lime/10 border-lime/30" },
};

// Status = icon + label (never colour alone); the label stays in ink colour.
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { Icon, cls, bg } = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${bg} ${cls}`}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span>{children}</span>
    </span>
  );
}

export type Severity = "info" | "warning" | "critical" | "INFO" | "WARNING" | "CRITICAL";
const SEV: Record<string, [Tone, string]> = {
  info: ["info", "Info"],
  warning: ["warn", "Warning"],
  critical: ["crit", "Critical"],
  INFO: ["info", "Info"],
  WARNING: ["warn", "Warning"],
  CRITICAL: ["crit", "Critical"],
};
export const SeverityBadge = ({ severity }: { severity: Severity | string }) => {
  const [tone, label] = SEV[severity] ?? ["info", String(severity)];
  return <Badge tone={tone}>{label}</Badge>;
};

export const OnlineBadge = ({ online }: { online: boolean }) =>
  online ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
      <span className="size-2 rounded-full bg-emerald-500 camera-pulse" />
      Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600 dark:border-zinc-700/40 dark:bg-zinc-800/40 dark:text-zinc-400">
      <span className="size-2 rounded-full bg-zinc-400" />
      Offline
    </span>
  );

export function Table({
  head,
  rows,
  align = [],
  empty = "Nothing to show.",
  maxH = "",
}: {
  head: string[];
  rows: ReactNode[][];
  align?: ("left" | "right")[];
  empty?: string;
  maxH?: string;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className={`-mx-5 overflow-x-auto sm:-mx-6 ${maxH && `${maxH} overflow-y-auto`}`}>
      <table className="w-full text-sm">
        <thead className={maxH && "sticky top-0 bg-surface z-10"}>
          <tr className="border-b border-line bg-surface-2/60 text-left text-xs uppercase tracking-wider font-extrabold text-forest">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-5 py-3 font-extrabold sm:px-6 ${
                  align[i] === "right" ? "text-right" : ""
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums divide-y divide-line/60">
          {rows.map((r, i) => (
            <tr
              key={i}
              className="transition-colors hover:bg-surface-2/40"
            >
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`whitespace-nowrap px-5 py-3 text-ink sm:px-6 ${
                    align[j] === "right" ? "text-right" : ""
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="py-12 text-center">
    <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
      <Info className="size-6 text-forest" />
    </div>
    <p className="mt-3 text-sm font-bold text-ink-2">{children}</p>
  </div>
);

export const Mono = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[0.8125rem] font-bold text-forest bg-surface-2 px-1.5 py-0.5 rounded-md border border-line">
    {children}
  </span>
);

export const Note = ({ children }: { children: ReactNode }) => (
  <p className="mt-4 text-xs font-semibold text-muted">{children}</p>
);
