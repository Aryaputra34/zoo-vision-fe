"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Car,
  Ticket,
  Store,
  Utensils,
  Video,
  WifiOff,
} from "lucide-react";
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
import {
  PageHeader,
  SafariHeroBanner,
  Card,
  Tile,
  Tiles,
  Table,
  SeverityBadge,
} from "@/components/ui";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { fmtLocalTime, localDayRange } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import { fmtNum } from "@/lib/util";

const ATTENTION_LIMIT = 5;
const typeLabel = (t: string) => t.replace(/_/g, " ");
const isCrit = (s: string) => s === "critical" || s === "CRITICAL";
const isWarn = (s: string) => s === "warning" || s === "WARNING";

export function OverviewPage({ date: picked }: { date?: string }) {
  const today = useToday();
  const date = picked ?? today;
  const isToday = date === today;
  const day = localDayRange(date);
  // Links to a sibling page keep the chosen date, except for today (the default of every page).
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

  // Metrics computation from endpoints
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
      const sev = r.group?.["severity"];
      if (sev === "warning" || sev === "WARNING") warningAlerts += r.count;
      if (sev === "critical" || sev === "CRITICAL") criticalAlerts += r.count;
    }

    let unattendedSec = 0;
    for (const r of unattendedQuery.data?.rows ?? []) {
      unattendedSec += r.totalSec ?? 0;
    }

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

    const allCameras = camerasQuery.data ?? [];
    const onlineCams = allCameras.filter((c) => liveStatus[c.id] !== undefined && liveStatus[c.id] !== null).length;

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
      onlineCams: onlineCams || allCameras.length,
      totalCams: allCameras.length,
    };
  }, [
    crossingsQuery.data,
    alertsQuery.data,
    unattendedQuery.data,
    occupancyQuery.data,
    tablesQuery.data,
    camerasQuery.data,
    liveStatus,
  ]);

  const recentEvents = recentEventsQuery.data?.rows ?? [];

  // "Butuh perhatian": warning/critical events of the day (critical first), then the cameras that
  // stopped reporting (today only). The one place where the operator looks first.
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

  const attentionCount = attention.events.length + attention.offline.length;
  const attentionCards = attention.events.slice(0, 3);
  const attentionRows = attention.events.slice(3);
  const loadingAttention = recentEventsQuery.isLoading;

  return (
    <>
      <PageHeader
        tag="Taman Safari Indonesia · Command Center"
        title="Ringkasan Operasional AI Vision"
        subtitle="Pusat pemantauan terpadu gerbang kendaraan, loket tiket, dining hall, wahana satwa, dan anomali sistem"
        date={date}
      >
        <CsvLink path="/api/v1/exports/summary.csv" params={{ ...day, bucket: "hour" }} />
      </PageHeader>

      <SafariHeroBanner
        date={date}
        onlineCams={metrics.onlineCams}
        totalEvents={metrics.totalEvents}
        todayVehicles={metrics.vehicleEntries}
      />

      {/* MANAGER and up: the configuration state of the cameras (only rendered for those roles). */}
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
            Tidak ada kejadian warning atau kritis{isToday ? " dan semua kamera melapor" : ` pada ${date}`}
          </p>
        ) : (
          <>
            {attentionCards.length > 0 && (
              <div className="grid grid-cols-1 gap-3.5 px-5 pb-4 sm:grid-cols-2 sm:px-[18px] xl:grid-cols-3">
                {attentionCards.map((e) => (
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
            {attentionRows.map((e) => (
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
                    title={`${e.cameraName ?? e.cameraId ?? "CCTV"} · ${date} ${fmtLocalTime(e.time)} WIB`}
                  />
                }
              />
            ))}
          </>
        )}
      </section>

      {/* Primary KPI Tiles */}
      <Tiles>
        <Tile
          label="Kendaraan Masuk (Safari)"
          icon={<Car aria-hidden />}
          value={crossingsQuery.isLoading ? "…" : fmtNum(metrics.vehicleEntries)}
          sub={`Keluar: ${fmtNum(metrics.vehicleExits)} unit (Selisih: ${fmtNum(
            metrics.vehicleEntries - metrics.vehicleExits
          )})`}
        />
        <Tile
          label="Wahana Tunggang Kuda"
          icon={<Ticket aria-hidden />}
          value={crossingsQuery.isLoading ? "…" : fmtNum(metrics.horseDepartures)}
          sub={`Kembali: ${fmtNum(metrics.horseReturns)} · Aktif: ${fmtNum(
            metrics.horseDepartures - metrics.horseReturns
          )}`}
        />
        <Tile
          label="Puncak Tamu Restoran"
          icon={<Utensils aria-hidden />}
          value={occupancyQuery.isLoading ? "…" : `${metrics.peakOccupancy} Orang`}
          sub={metrics.peakTime !== "—" ? `Tercatat pada pukul ${metrics.peakTime} WIB` : "Belum ada kunjungan"}
        />
        <Tile
          label="Loket Tanpa Petugas"
          icon={<Store aria-hidden />}
          value={unattendedQuery.isLoading ? "…" : `${metrics.unattendedMinutes} Menit`}
          sub="Akumulasi waktu absen kasir loket"
        />
      </Tiles>

      {/* Secondary Operational Status Cards */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          title="Kepadatan Meja Dining Hall"
          subtitle="Sesi meja dan durasi makan tamu di Safari Rainforest Dining"
          actions={
            <Link
              href={date === today ? "/restaurant" : `/restaurant?date=${date}`}
              className="text-xs font-bold text-forest hover:underline"
            >
              Lihat Detail →
            </Link>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-xs font-semibold text-ink-2">Total Meja Terisi</span>
              <span className="text-base font-black text-forest">{fmtNum(metrics.seatedTables)} Meja</span>
            </div>
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-xs font-semibold text-ink-2">Rata-Rata Waktu Singgah</span>
              <span className="text-base font-black text-forest">
                {metrics.avgStayMinutes > 0 ? `${metrics.avgStayMinutes} Menit` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-2">Sensor Meja Aktif</span>
              <span className="text-xs font-bold text-emerald-600">Online & Beroperasi</span>
            </div>
          </div>
        </Card>

        <Card
          title="Kesiapan Loket Kasir POS"
          subtitle="Status antrean dan kepatuhan kehadiran staf loket tiket"
          actions={
            <Link
              href={date === today ? "/cashier" : `/cashier?date=${date}`}
              className="text-xs font-bold text-forest hover:underline"
            >
              Lihat Detail →
            </Link>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-xs font-semibold text-ink-2">Durasi Kasir Kosong</span>
              <span className="text-base font-black text-amber-600">
                {metrics.unattendedMinutes} Menit
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <span className="text-xs font-semibold text-ink-2">Anomali Waktu Antre</span>
              <span className="text-base font-black text-forest">Terkendali</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-2">Loket Tiket Utama</span>
              <span className="text-xs font-bold text-emerald-600">Terbuka untuk Umum</span>
            </div>
          </div>
        </Card>

        <Card
          title="Kejadian & Peringatan Sistem"
          subtitle="Rekapitulasi severity log sensor AI Vision hari ini"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-red-500" />
                <span className="text-xs font-semibold text-ink-2">Critical Incidents</span>
              </div>
              <span className="text-base font-black text-red-600">
                {fmtNum(metrics.criticalAlerts)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold text-ink-2">Warnings</span>
              </div>
              <span className="text-base font-black text-amber-600">
                {fmtNum(metrics.warningAlerts)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-lime" />
                <span className="text-xs font-semibold text-ink-2">Total Kejadian Tercatat</span>
              </div>
              <span className="text-base font-black text-forest">
                {fmtNum(metrics.totalEvents)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Incidents and Events Stream */}
      <Card
        title="Aliran Kejadian & Bukti Rekaman Terbaru (Live Stream)"
        subtitle="Log deteksi kejadian real-time dengan tautan bukti foto snapshot dan video klip insiden"
        actions={
          <Link href="/events" className="text-xs font-bold text-forest hover:underline">
            Semua Log Kejadian →
          </Link>
        }
      >
        <Table
          head={["Waktu", "Tipe Kejadian", "Tingkat (Severity)", "Kamera CCTV", "Bukti Visual"]}
          rows={recentEvents.map((e) => [
            fmtLocalTime(e.time),
            <span key="type" className="font-extrabold text-forest">
              {e.type.replace(/_/g, " ")}
            </span>,
            <SeverityBadge key="sev" severity={e.severity} />,
            e.cameraName ?? e.cameraId ?? "—",
            <EvidenceButton
              key="ev"
              snapshotUrl={e.snapshotUrl}
              clipUrl={e.clipUrl}
              title={`${e.cameraName ?? e.cameraId ?? "CCTV"} · ${date} ${fmtLocalTime(e.time)} WIB`}
            />,
          ])}
          empty={
            recentEventsQuery.isLoading
              ? "Memuat kejadian..."
              : recentEvents.length === 0
              ? `Tidak ada kejadian tercatat pada tanggal ${date}.`
              : undefined
          }
        />
      </Card>
    </>
  );
}

function AttentionCard({ event: e, date }: { event: EventRowDto; date: string }) {
  const crit = isCrit(e.severity);
  const title = `${e.cameraName ?? e.cameraId ?? "CCTV"} · ${date} ${fmtLocalTime(e.time)} WIB`;
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
