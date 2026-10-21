"use client";

import { Suspense, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Car, Store, Ticket, Utensils, Video, WifiOff } from "lucide-react";
import {
  useReportsEventStats,
  useReportsIntervalStats,
  useReportsMetricSeries,
} from "@/api/generated/reports/reports";
import { useEventsList } from "@/api/generated/events/events";
import { useCamerasList } from "@/api/generated/cameras/cameras";
import type { EventRowDto } from "@/api/generated/zooVisionAPI.schemas";
import { useMe } from "@/auth/AuthProvider";
import { roleAtLeast, type Role } from "@/auth/roles";
import { ManagementPanel } from "./ManagementPanel";
import { useStatus } from "@/live";
import { Card, Table, SeverityBadge } from "@/components/ui";
import { DatePicker, HourlyBars } from "@/components/client";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { fillBuckets } from "@/lib/buckets";
import { fmtLocalTime, localDayRange, localHour, siteTimeZone, siteZoneLabel } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import { fmtNum, operatingHours } from "@/lib/util";

const ATTENTION_LIMIT = 5;

const typeLabel = (t: string) => t.replace(/_/g, " ");
const isCrit = (s: string) => s === "critical" || s === "CRITICAL";
const isWarn = (s: string) => s === "warning" || s === "WARNING";

function greeting(): string {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: siteTimeZone(), hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

export function OverviewPage({ date: picked }: { date?: string }) {
  const today = useToday();
  const date = picked ?? today;
  const isToday = date === today;
  const day = localDayRange(date);
  const withDate = (href: string) => (isToday ? href : `${href}?date=${date}`);
  const { me } = useMe();

  // Crossings
  const crossingsQuery = useReportsEventStats({
    ...day,
    bucket: "day",
    types: "vehicle_crossing,horse_crossing",
    groupBy: "type,data.direction",
  });

  // Alerts
  const alertsQuery = useReportsEventStats({
    ...day,
    bucket: "day",
    groupBy: "severity",
  });

  // Events per hour by severity (chart)
  const hourlyQuery = useReportsEventStats({
    ...day,
    bucket: "hour",
    groupBy: "severity",
  });

  // Desk Unattended
  const unattendedQuery = useReportsIntervalStats({
    ...day,
    bucket: "day",
    kind: "desk_unattended",
  });

  // Occupancy series (5m peak)
  const occupancyQuery = useReportsMetricSeries({
    ...day,
    bucket: "5m",
    name: "occupancy",
    agg: "max",
  });

  // Restaurant tables
  const tablesQuery = useReportsIntervalStats({
    ...day,
    bucket: "day",
    kind: "table_session",
  });

  // Recent events stream
  const recentEventsQuery = useEventsList({
    ...day,
    limit: 20,
  });

  const camerasQuery = useCamerasList();
  const { cameras: liveStatus } = useStatus();

  const metrics = useMemo(() => {
    let vehicleEntries = 0;
    let vehicleExits = 0;
    let horseDepartures = 0;
    let horseReturns = 0;

    for (const r of crossingsQuery.data?.rows ?? []) {
      const type = r.group?.["type"];
      const dir = r.group?.["data.direction"];
      if (type === "vehicle_crossing") {
        if (dir === "ENTRY") vehicleEntries += r.count;
        if (dir === "EXIT") vehicleExits += r.count;
      } else if (type === "horse_crossing") {
        if (dir === "DEPARTURE") horseDepartures += r.count;
        if (dir === "RETURN") horseReturns += r.count;
      }
    }

    let warningAlerts = 0;
    let criticalAlerts = 0;
    let totalEvents = 0;
    for (const r of alertsQuery.data?.rows ?? []) {
      totalEvents += r.count;
      const sev = String(r.group?.["severity"] ?? "");
      if (isWarn(sev)) warningAlerts += r.count;
      if (isCrit(sev)) criticalAlerts += r.count;
    }

    let unattendedSec = 0;
    for (const r of unattendedQuery.data?.rows ?? []) unattendedSec += r.totalSec ?? 0;

    let peakOccupancy = 0;
    let peakTime = "—";
    for (const r of occupancyQuery.data?.rows ?? []) {
      if (r.value !== undefined && r.value > peakOccupancy) {
        peakOccupancy = r.value;
        peakTime = fmtLocalTime(r.bucketStart);
      }
    }

    let seatedTables = 0;
    let totalStaySec = 0;
    for (const r of tablesQuery.data?.rows ?? []) {
      seatedTables += r.count;
      totalStaySec += (r.avgSec ?? 0) * r.count;
    }
    const avgStayMinutes = seatedTables > 0 ? Math.round(totalStaySec / seatedTables / 60) : 0;

    return {
      vehicleEntries,
      vehicleExits,
      horseDepartures,
      horseReturns,
      warningAlerts,
      criticalAlerts,
      totalEvents,
      unattendedMinutes: Math.round(unattendedSec / 60),
      peakOccupancy,
      peakTime,
      seatedTables,
      avgStayMinutes,
    };
  }, [crossingsQuery.data, alertsQuery.data, unattendedQuery.data, occupancyQuery.data, tablesQuery.data]);

  const hourly = useMemo(() => {
    const filled = fillBuckets(hourlyQuery.data?.rows ?? [], day.from, day.to, "hour", (bucketStart) => ({
      bucketStart,
      count: 0,
      group: {},
    }));
    const byHour = new Map<string, { hour: string; critical: number; warning: number; info: number }>();
    for (const r of filled) {
      const h = String(Number(localHour(r.bucketStart)));
      const cur = byHour.get(h) ?? { hour: h, critical: 0, warning: 0, info: 0 };
      const sev = String((r.group as Record<string, unknown> | undefined)?.["severity"] ?? "");
      if (isCrit(sev)) cur.critical += r.count;
      else if (isWarn(sev)) cur.warning += r.count;
      else if (sev) cur.info += r.count;
      byHour.set(h, cur);
    }
    const rows = Array.from(byHour.values()).sort((a, b) => Number(a.hour) - Number(b.hour));
    const trimmed = operatingHours(rows, (r) => r.critical + r.warning + r.info === 0);
    let peak: { hour: string; total: number } | null = null;
    for (const r of trimmed) {
      const total = r.critical + r.warning + r.info;
      if (total > 0 && (!peak || total > peak.total)) peak = { hour: r.hour, total };
    }
    return { rows: trimmed, peak };
  }, [hourlyQuery.data, day.from, day.to]);

  const recentEvents = recentEventsQuery.data?.rows ?? [];

  // Butuh perhatian: warning/critical events of the day (critical first), then cameras not reporting (today only).
  const attention = useMemo(() => {
    const events = recentEvents
      .filter((e) => isCrit(e.severity) || isWarn(e.severity))
      .sort((a, b) => Number(isCrit(b.severity)) - Number(isCrit(a.severity)) || b.time.localeCompare(a.time))
      .slice(0, ATTENTION_LIMIT);
    const offline = isToday
      ? (camerasQuery.data ?? []).filter((c) => c.enabled && liveStatus[c.id] === null)
      : [];
    return { events, offline };
  }, [recentEvents, camerasQuery.data, liveStatus, isToday]);

  const cards = attention.events.slice(0, 3);
  const rows = attention.events.slice(3);
  const attentionCount = attention.events.length + attention.offline.length;
  const loadingAttention = recentEventsQuery.isLoading;
  const firstName = me?.name?.split(/\s+/)[0];

  const kpis = [
    {
      label: "Kejadian kritis",
      value: metrics.criticalAlerts,
      chip: metrics.criticalAlerts > 0 ? "Perlu cek" : "Aman",
      chipCls: metrics.criticalAlerts > 0 ? "bg-crit text-white" : "bg-lime/25 text-[#d9f0b8]",
    },
    {
      label: "Warning",
      value: metrics.warningAlerts,
      chip: metrics.warningAlerts > 0 ? "Pantau" : "Aman",
      chipCls: metrics.warningAlerts > 0 ? "bg-warn text-[#3b2604]" : "bg-lime/25 text-[#d9f0b8]",
    },
    {
      label: "Total kejadian",
      value: metrics.totalEvents,
      chip: isToday ? "Hari ini" : date,
      chipCls: "bg-white/15 text-white",
    },
  ];

  const areas = [
    {
      href: withDate("/vehicles"),
      label: "Gerbang kendaraan",
      Icon: Car,
      value: fmtNum(metrics.vehicleEntries),
      unit: "masuk",
      note: `Keluar ${fmtNum(metrics.vehicleExits)} · selisih ${fmtNum(metrics.vehicleEntries - metrics.vehicleExits)}`,
      loading: crossingsQuery.isLoading,
      tone: "good" as const,
    },
    {
      href: withDate("/cashier"),
      label: "Loket kasir",
      Icon: Store,
      value: `${metrics.unattendedMinutes}`,
      unit: "menit kosong",
      note: "Total waktu loket tanpa kasir",
      loading: unattendedQuery.isLoading,
      tone: metrics.unattendedMinutes > 0 ? ("crit" as const) : ("good" as const),
    },
    {
      href: withDate("/restaurant"),
      label: "Restoran",
      Icon: Utensils,
      value: `${metrics.peakOccupancy}`,
      unit: "tamu (puncak)",
      note:
        metrics.peakTime !== "—"
          ? `Pukul ${metrics.peakTime} · ${fmtNum(metrics.seatedTables)} meja${
              metrics.avgStayMinutes > 0 ? ` · rata-rata ${metrics.avgStayMinutes} mnt` : ""
            }`
          : "Belum ada kunjungan",
      loading: occupancyQuery.isLoading,
      tone: "warn" as const,
    },
    {
      href: withDate("/rides"),
      label: "Wahana kuda",
      Icon: Ticket,
      value: fmtNum(metrics.horseDepartures),
      unit: "berangkat",
      note: `Kembali ${fmtNum(metrics.horseReturns)} · di lintasan ${fmtNum(
        metrics.horseDepartures - metrics.horseReturns,
      )}`,
      loading: crossingsQuery.isLoading,
      tone: "good" as const,
    },
  ];
  const TONE_CARD = {
    good: "bg-[#f1f8ec] border-[#dcebd0]",
    warn: "bg-[#fdf7ea] border-[#f3e3c0]",
    crit: "bg-[#fdf3f1] border-[#f6d9d4]",
  };
  const TONE_DOT = { good: "bg-good", warn: "bg-warn", crit: "bg-crit" };

  return (
    <>
      {/* Hero: greeting and today's three numbers (live status lives in the sidebar) */}
      <section
        aria-label="Ringkasan hari ini"
        className="hero-band relative mb-5 overflow-hidden rounded-[20px] text-white shadow-[0_18px_40px_rgba(12,53,32,0.2)]"
      >
        <div className="relative flex flex-col gap-6 p-5 sm:p-7 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 xl:min-w-[470px]">
            <h1 className="text-[26px] leading-tight font-extrabold tracking-tight sm:text-[30px]" suppressHydrationWarning>
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-[15px] text-[#cfe3d4]">
              {isToday ? "Ringkasan operasional hari ini, sejak taman buka." : `Ringkasan operasional tanggal ${date}.`}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <a
                href="#perhatian"
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-lime px-3.5 text-[13px] font-extrabold text-forest-dark hover:bg-lime-2"
              >
                Cek yang butuh perhatian ↓
              </a>
              <CsvLink path="/api/v1/exports/summary.csv" params={{ ...day, bucket: "hour" }} />
              <Suspense fallback={null}>
                <DatePicker date={date} today={today} />
              </Suspense>
            </div>
          </div>
          <div className="grid flex-[1.4] grid-cols-1 gap-3 sm:grid-cols-3">
            {kpis.map((k) => (
              <Link
                key={k.label}
                href={withDate("/events")}
                className="flex flex-col gap-1.5 rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.12]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#cfe3d4]">{k.label}</span>
                  <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold ${k.chipCls}`}>{k.chip}</span>
                </span>
                <span className="text-[34px] leading-none font-extrabold tracking-tight tabular-nums">
                  {alertsQuery.isLoading ? "…" : fmtNum(k.value)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {me && roleAtLeast(me.role as Role, "MANAGER") && (
        <ManagementPanel cameras={camerasQuery.data ?? []} liveStatus={liveStatus} day={day} isToday={isToday} />
      )}

      {/* Butuh perhatian: the one place for problems, most urgent first */}
      <section
        id="perhatian"
        aria-label="Butuh perhatian"
        className="mb-5 scroll-mt-20 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(19,36,26,0.04)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-[18px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[17px] font-extrabold">Butuh perhatian</h2>
            {attentionCount > 0 && (
              <span className="rounded-full bg-crit px-2.5 py-0.5 text-xs font-extrabold text-white">{attentionCount}</span>
            )}
            <span className="text-xs font-semibold text-muted">diurutkan dari yang paling mendesak</span>
          </div>
          <Link href={withDate("/events")} className="inline-flex items-center gap-1 text-[13px] font-bold text-forest hover:underline">
            Semua kejadian <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>

        {loadingAttention ? (
          <p className="px-5 pb-6 text-sm text-muted sm:px-[18px]">Memuat kejadian…</p>
        ) : attentionCount === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted sm:px-[18px]">
            Tidak ada kejadian warning atau kritis{isToday ? " dan semua kamera melapor" : ` pada ${date}`}.
          </p>
        ) : (
          <>
            {cards.length > 0 && (
              <div className="grid grid-cols-1 gap-3.5 px-5 pb-4 sm:grid-cols-2 sm:px-[18px] xl:grid-cols-3">
                {cards.map((e) => (
                  <AttentionCard key={e.id} event={e} date={date} />
                ))}
              </div>
            )}
            {attention.offline.map((c) => (
              <AttentionRow
                key={`off-${c.id}`}
                stripe="bg-off"
                badge={
                  <span className="inline-flex items-center gap-1 rounded-full bg-off-bg px-2 py-0.5 text-[11px] font-extrabold text-[#4b5550]">
                    <WifiOff aria-hidden className="size-3" /> Offline
                  </span>
                }
                title="Kamera tidak melapor"
                meta={c.name}
                action={
                  <Link
                    href={`/live?cam=${encodeURIComponent(c.id)}`}
                    className="inline-flex h-[34px] items-center rounded-[9px] border border-[#cfc9b8] px-3 text-[13px] font-bold text-ink hover:bg-surface-2"
                  >
                    Detail kamera
                  </Link>
                }
              />
            ))}
            {rows.map((e) => (
              <AttentionRow
                key={e.id}
                stripe={isCrit(e.severity) ? "bg-crit" : "bg-warn"}
                badge={<SeverityBadge severity={e.severity} />}
                title={typeLabel(e.type)}
                meta={`${e.cameraName ?? e.cameraId ?? "—"} · ${fmtLocalTime(e.time)}`}
                action={
                  <EvidenceButton
                    snapshotUrl={e.snapshotUrl}
                    clipUrl={e.clipUrl}
                    title={`${e.cameraName ?? e.cameraId ?? "CCTV"} · ${date} ${fmtLocalTime(e.time)} ${siteZoneLabel()}`}
                  />
                }
              />
            ))}
          </>
        )}
      </section>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <Card
          title="Kejadian per jam"
          subtitle={
            hourly.peak ? `Jam tersibuk: ${hourly.peak.hour}.00 (${fmtNum(hourly.peak.total)} kejadian)` : "Belum ada kejadian"
          }
        >
          <HourlyBars
            data={hourly.rows}
            series={[
              { key: "critical", label: "Kritis", color: "#b42318" },
              { key: "warning", label: "Warning", color: "#e9a23b" },
              { key: "info", label: "Info", color: "#4f9a63" },
            ]}
          />
        </Card>

        <Card
          title="Area operasional"
          actions={
            <Link href={withDate("/vehicles")} className="text-[13px] font-bold text-forest hover:underline">
              Buka →
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
            {areas.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className={`flex flex-col gap-1.5 rounded-xl border p-3 transition-transform hover:-translate-y-0.5 ${TONE_CARD[a.tone]}`}
              >
                <span className="flex items-center justify-between">
                  <span className="grid size-[30px] place-items-center rounded-lg bg-white text-forest">
                    <a.Icon aria-hidden className="size-4" />
                  </span>
                  <span className={`size-2 rounded-full ${TONE_DOT[a.tone]}`} />
                </span>
                <span className="text-xs font-bold text-ink-2">{a.label}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[22px] font-extrabold tracking-tight tabular-nums">{a.loading ? "…" : a.value}</span>
                  <span className="text-[11px] font-semibold text-muted">{a.unit}</span>
                </span>
                <span className="text-[11px] font-medium text-muted">{a.note}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Latest events with evidence (all severities) */}
      <Card
        title="Kejadian terbaru"
        subtitle="20 deteksi terakhir dengan bukti foto dan klip"
        actions={
          <Link href={withDate("/events")} className="text-[13px] font-bold text-forest hover:underline">
            Semua kejadian →
          </Link>
        }
      >
        <Table
          head={["Waktu", "Tipe kejadian", "Tingkat", "Kamera", "Bukti"]}
          rows={recentEvents.map((e) => [
            <span key="t" className="font-mono text-xs">{fmtLocalTime(e.time)}</span>,
            <span key="type" className="font-bold capitalize text-ink">
              {typeLabel(e.type)}
            </span>,
            <SeverityBadge key="sev" severity={e.severity} />,
            e.cameraName ?? e.cameraId ?? "—",
            <EvidenceButton
              key="ev"
              snapshotUrl={e.snapshotUrl}
              clipUrl={e.clipUrl}
              title={`${e.cameraName ?? e.cameraId ?? "CCTV"} · ${date} ${fmtLocalTime(e.time)} ${siteZoneLabel()}`}
            />,
          ])}
          empty={recentEventsQuery.isLoading ? "Memuat kejadian…" : `Tidak ada kejadian tercatat pada tanggal ${date}.`}
        />
      </Card>
    </>
  );
}

function AttentionCard({ event: e, date }: { event: EventRowDto; date: string }) {
  const crit = isCrit(e.severity);
  const title = `${e.cameraName ?? e.cameraId ?? "CCTV"} · ${date} ${fmtLocalTime(e.time)} ${siteZoneLabel()}`;
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-[14px] border bg-surface transition-shadow hover:shadow-[0_14px_30px_rgba(12,53,32,0.16)] ${
        crit ? "border-[#f3c7c1]" : "border-line"
      }`}
    >
      <div className="relative aspect-video bg-[#1b2822] 2xl:aspect-[21/9]">
        {e.snapshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a session-protected JPEG from the API
          <img src={e.snapshotUrl} alt={`Snapshot ${title}`} loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-xs font-semibold text-white/60">Tanpa snapshot</span>
        )}
        <span className="absolute right-2 bottom-1.5 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[11px] text-white">
          {fmtLocalTime(e.time)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <span className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={e.severity} />
          <span className="text-xs font-semibold text-muted">{e.cameraName ?? e.cameraId ?? "—"}</span>
        </span>
        <span className="text-[15px] leading-snug font-extrabold capitalize">{typeLabel(e.type)}</span>
        <div className="mt-auto flex items-center gap-2 pt-1">
          {e.cameraId && (
            <Link
              href={`/live?cam=${encodeURIComponent(e.cameraId)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-forest px-3 text-[13px] font-bold text-white hover:bg-accent-hover"
            >
              <Video aria-hidden className="size-3.5" /> Lihat live
            </Link>
          )}
          <EvidenceButton snapshotUrl={e.snapshotUrl} clipUrl={e.clipUrl} title={title} />
        </div>
      </div>
    </article>
  );
}

function AttentionRow({
  stripe,
  badge,
  title,
  meta,
  action,
}: {
  stripe: string;
  badge: ReactNode;
  title: string;
  meta: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-t border-line-soft py-3 pr-5 transition-colors hover:bg-[#faf8f2] sm:pr-[18px]">
      <span className={`w-1 self-stretch rounded-r ${stripe}`} />
      <span className="shrink-0">{badge}</span>
      <span className="flex min-w-[200px] flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-sm font-bold capitalize">{title}</span>
        <span className="text-[13px] text-muted">{meta}</span>
      </span>
      {action}
    </div>
  );
}
