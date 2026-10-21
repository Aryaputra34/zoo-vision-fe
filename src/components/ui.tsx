import { type ReactNode, Suspense } from "react";
import {
  CircleCheck,
  CircleDot,
  Info,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import { todayWib } from "@/lib/util";
import { DatePicker } from "./client";

// Page hero band (Ringkasan pattern): canopy-green photo band, white title, actions on the right.
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
    <header className="hero-band relative mb-5 overflow-hidden rounded-[18px] px-5 py-5 text-white shadow-[0_14px_32px_rgba(12,53,32,0.18)] sm:px-6 sm:py-[22px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {tag && (
            <div className="mb-2 inline-flex items-center rounded-full border border-lime/40 bg-lime/15 px-2.5 py-0.5 text-[11px] font-bold text-[#d9f0b8]">
              {tag}
            </div>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px] sm:leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-[#cfe3d4]">{subtitle}</p>}
        </div>
        {(children || date) && (
          <div className="flex flex-wrap items-center gap-2">
            {children}
            {date && (
              <Suspense fallback={null}>
                <DatePicker date={date} today={todayWib()} />
              </Suspense>
            )}
          </div>
        )}
      </div>
    </header>
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
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08] ${className}`}>
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
    <div className="relative min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(19,36,26,0.04)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="text-[13px] font-semibold text-muted">{label}</div>
          {badge}
        </div>
        {icon && (
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime-soft text-forest [&_svg]:size-[18px]">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 text-[28px] leading-tight font-extrabold tracking-tight text-ink tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs font-medium text-muted">{sub}</div>}
    </div>
  );
}

export const Tiles = ({ children }: { children: ReactNode }) => (
  <div className="mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">{children}</div>
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
      className={`min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(19,36,26,0.04)] ${className}`}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3 sm:px-[18px]">
          <div className="min-w-0">
            {title && <h2 className="text-base font-extrabold tracking-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={title || actions ? "px-5 pb-5 sm:px-[18px]" : "p-5 sm:p-[18px]"}>{children}</div>
    </section>
  );
}

export type Tone = "good" | "warn" | "crit" | "off" | "info";
const TONE: Record<Tone, { Icon: typeof Info; cls: string; bg: string }> = {
  good: { Icon: CircleCheck, cls: "text-good", bg: "bg-good-bg border-good/15" },
  warn: { Icon: TriangleAlert, cls: "text-gold-ink", bg: "bg-warn-bg border-warn/30" },
  crit: { Icon: OctagonAlert, cls: "text-crit-ink", bg: "bg-crit-bg border-crit/20" },
  off: { Icon: CircleDot, cls: "text-[#4b5550]", bg: "bg-off-bg border-off/20" },
  info: { Icon: Info, cls: "text-info", bg: "bg-info-bg border-info/15" },
};

// Status = icon + label (never colour alone); the label stays in ink colour.
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { Icon, cls, bg } = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${bg} ${cls}`}
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
  critical: ["crit", "Kritis"],
  INFO: ["info", "Info"],
  WARNING: ["warn", "Warning"],
  CRITICAL: ["crit", "Kritis"],
};
export const SeverityBadge = ({ severity }: { severity: Severity | string }) => {
  const [tone, label] = SEV[severity] ?? ["info", String(severity)];
  return <Badge tone={tone}>{label}</Badge>;
};

export const OnlineBadge = ({ online }: { online: boolean }) =>
  online ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-good/15 bg-good-bg px-2.5 py-0.5 text-xs font-bold text-good">
      <span className="size-2 rounded-full bg-good camera-pulse" />
      Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-off/20 bg-off-bg px-2.5 py-0.5 text-xs font-bold text-[#4b5550]">
      <span className="size-2 rounded-full bg-off" />
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
    <div className={`-mx-5 overflow-x-auto sm:-mx-[18px] ${maxH && `${maxH} overflow-y-auto`}`}>
      <table className="w-full text-sm">
        <thead className={maxH && "sticky top-0 bg-surface z-10"}>
          <tr className="border-y border-line bg-surface-2 text-left text-xs font-bold text-ink-2">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-5 py-2.5 font-bold sm:px-[18px] ${
                  align[i] === "right" ? "text-right" : ""
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums divide-y divide-line-soft">
          {rows.map((r, i) => (
            <tr
              key={i}
              className="transition-colors hover:bg-[#faf8f2]"
            >
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`whitespace-nowrap px-5 py-2.5 text-ink sm:px-[18px] ${
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
  <div className="py-10 text-center">
    <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-surface-2 text-muted">
      <Info className="size-5 text-forest" />
    </div>
    <p className="mt-3 text-sm font-semibold text-ink-2">{children}</p>
  </div>
);

export const Mono = ({ children }: { children: ReactNode }) => (
  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[0.8125rem] font-medium text-ink-2">
    {children}
  </span>
);

export const Note = ({ children }: { children: ReactNode }) => (
  <p className="mt-4 text-xs text-muted">{children}</p>
);
