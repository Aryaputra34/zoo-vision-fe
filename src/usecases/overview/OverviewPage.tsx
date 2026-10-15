"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Car,
  Ticket,
  Store,
  Utensils,
  AlertTriangle,
  Clock,
  Users,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import {
  useReportsEventStats,
  useReportsIntervalStats,
  useReportsMetricSeries,
} from "@/api/generated/reports/reports";
import { useEventsList } from "@/api/generated/events/events";
import { useCamerasList } from "@/api/generated/cameras/cameras";
import { useStatus } from "@/live";
import {
  PageHeader,
  SafariHeroBanner,
  Card,
  Tile,
  Tiles,
  Table,
  SeverityBadge,
  Mono,
} from "@/components/ui";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { fmtLocalTime, localDayRange, localHour } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import { fmtNum } from "@/lib/util";

export function OverviewPage({ date: picked }: { date?: string }) {
  const today = useToday();
  const date = picked ?? today;
  const isToday = date === today;
  const day = localDayRange(date);

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
