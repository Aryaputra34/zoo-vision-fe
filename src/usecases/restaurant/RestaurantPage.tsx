"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Utensils, Users, Clock, AlertTriangle, ShieldAlert, Sparkles } from "lucide-react";
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
  Card,
  Table,
  Tile,
  Tiles,
  SeverityBadge,
  Badge,
  Mono,
} from "@/components/ui";
import { OccupancyChart } from "@/components/client";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { LivePausedBadge } from "@/components/LivePausedBadge";
import { fmtLocalTime, localDayRange } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import { fmtNum } from "@/lib/util";

const WARNING_CAPACITY = 60;
const MAX_CAPACITY = 80;
const LIST_LIMIT = 200;

export function RestaurantPage({ date: picked }: { date?: string }) {
  const today = useToday();
  const date = picked ?? today;
  const isToday = date === today;
  const day = localDayRange(date);

  // 5m Occupancy metric curve
  const occupancyQuery = useReportsMetricSeries({
    ...day,
    bucket: "5m",
    name: "occupancy",
    agg: "max",
  });

  // Busy minutes (above warning capacity)
  const busyMinutesQuery = useReportsMetricSeries({
    ...day,
    bucket: "hour",
    name: "occupancy",
    above: WARNING_CAPACITY,
  });

  // Capacity alerts by level
  const capacityAlertsQuery = useReportsEventStats({
    ...day,
    bucket: "day",
    types: "capacity_alert",
    groupBy: "data.level",
  });

  // Table session intervals (seated count and avg stay)
  const tableSessionQuery = useReportsIntervalStats({
    ...day,
    bucket: "day",
    kind: "table_session",
  });

  // Events list
  const listQuery = useEventsList({
    ...day,
    types: "capacity_alert",
    limit: LIST_LIMIT,
  });

  const camerasQuery = useCamerasList();
  const { cameras: liveStatus, paused } = useStatus();

  // Find restaurant cameras
  const restaurantCameras = useMemo(() => {
    return (camerasQuery.data ?? []).filter(
      (c) => c.useCase === "restaurant_counter" || c.useCase === "restaurant_table"
    );
  }, [camerasQuery.data]);

  // Format occupancy chart data
  const chartData = useMemo(() => {
    const rows = occupancyQuery.data?.rows ?? [];
    return rows.map((r) => ({
      time: fmtLocalTime(r.bucketStart),
      occupancy: r.value ?? 0,
    }));
  }, [occupancyQuery.data]);

  // Calculate totals
  const totals = useMemo(() => {
    let peakGuests = 0;
    let peakTime = "—";
    for (const r of occupancyQuery.data?.rows ?? []) {
      if (r.value !== undefined && r.value > peakGuests) {
        peakGuests = r.value;
        peakTime = fmtLocalTime(r.bucketStart);
      }
    }

    let busyMinutes = 0;
    for (const r of busyMinutesQuery.data?.rows ?? []) {
      busyMinutes += r.value ?? 0;
    }

    let tablesSeated = 0;
    let totalStaySec = 0;
    for (const r of tableSessionQuery.data?.rows ?? []) {
      tablesSeated += r.count;
      totalStaySec += (r.avgSec ?? 0) * r.count;
    }
    const avgStayMinutes = tablesSeated > 0 ? Math.round(totalStaySec / tablesSeated / 60) : 0;

    let warningAlerts = 0;
    let criticalAlerts = 0;
    for (const r of capacityAlertsQuery.data?.rows ?? []) {
      const lvl = r.group?.["data.level"];
      if (lvl === "warning" || lvl === "WARNING") warningAlerts += r.count;
      if (lvl === "critical" || lvl === "CRITICAL") criticalAlerts += r.count;
    }

    return {
      peakGuests,
      peakTime,
      busyMinutes,
      tablesSeated,
      avgStayMinutes,
      warningAlerts,
      criticalAlerts,
    };
  }, [occupancyQuery.data, busyMinutesQuery.data, tableSessionQuery.data, capacityAlertsQuery.data]);

  // Aggregate live tables from status.live.tables
  const liveTables = useMemo(() => {
    const list: Array<{ id: string; name: string; state: string; seatedAt?: string }> = [];
    for (const cam of restaurantCameras) {
      const status = liveStatus[cam.id];
      const tables = (status?.live as { tables?: Record<string, { name?: string; state?: string; seatedAt?: string }> })?.tables;
      if (tables && typeof tables === "object") {
        for (const [tblId, tblData] of Object.entries(tables)) {
          list.push({
            id: tblId,
            name: tblData.name ?? tblId,
            state: tblData.state ?? "EMPTY",
            seatedAt: tblData.seatedAt,
          });
        }
      }
    }
    return list;
  }, [restaurantCameras, liveStatus]);

  return (
    <>
      <PageHeader
        tag="Taman Safari Bogor · Rainforest Dining"
        title="Safari Dining Hall & Okupansi Restoran"
        subtitle="Analisis sensor kapasitas pengunjung, durasi makan tamu di meja, dan peringatan batas daya tampung"
        date={date}
      >
        <CsvLink
          path="/api/v1/exports/events.csv"
          params={{ ...day, types: "capacity_alert" }}
        />
      </PageHeader>

      <Tiles>
        <Tile
          label="Puncak Tamu Bersamaan"
          icon={<Users aria-hidden />}
          value={occupancyQuery.isLoading ? "…" : `${totals.peakGuests} Orang`}
          sub={totals.peakTime !== "—" ? `Tercatat pada ${totals.peakTime} WIB` : "Belum ada kunjungan"}
        />
        <Tile
          label="Durasi Kapasitas Padat"
          icon={<Clock aria-hidden />}
          value={busyMinutesQuery.isLoading ? "…" : `${totals.busyMinutes} Menit`}
          sub={`Okupansi di atas ambang batas ${WARNING_CAPACITY} tamu`}
        />
        <Tile
          label="Total Meja Terlayani"
          icon={<Utensils aria-hidden />}
          value={tableSessionQuery.isLoading ? "…" : fmtNum(totals.tablesSeated)}
          sub="Sesi meja dining hall tercatat hari ini"
        />
        <Tile
          label="Rata-Rata Waktu Makan"
          icon={<Clock aria-hidden />}
          value={totals.avgStayMinutes > 0 ? `${totals.avgStayMinutes} Menit` : "—"}
          sub="Estimasi perputaran tamu di meja"
        />
      </Tiles>

      {/* Occupancy Curve Chart */}
      <div className="mb-6">
        <Card
          title="Kurva Okupansi & Kapasitas Restoran (5-Minute Peaks)"
          subtitle={`Grafik jumlah tamu realtime dengan garis batas peringatan (${WARNING_CAPACITY} tamu) dan batas maksimal (${MAX_CAPACITY} tamu)`}
        >
          {chartData.length > 0 ? (
            <OccupancyChart
              data={chartData}
              warning={WARNING_CAPACITY}
              max={MAX_CAPACITY}
            />
          ) : (
            <div className="py-16 text-center text-xs font-bold text-muted">
              Tidak ada data okupansi pada tanggal {date}.
            </div>
          )}
        </Card>
      </div>

      {/* Live Table Monitor (if today) */}
      {isToday && liveTables.length > 0 && (
        <div className="mb-6">
          <Card
            title="Denah Meja Restoran Real-Time (Live Tables)"
            subtitle="Status keterisian meja makan dari sensor kamera AI CCTV"
            actions={<LivePausedBadge />}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {liveTables.map((t) => {
                const isOccupied = t.state === "OCCUPIED" || t.state === "SEATED";
                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl border p-3 text-center transition ${
                      isOccupied
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                        : "border-line bg-surface text-muted"
                    }`}
                  >
                    <div className="text-xs font-extrabold">{t.name}</div>
                    <div
                      className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        isOccupied ? "bg-emerald-200/60 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {isOccupied ? "Terisi" : "Kosong"}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Alert Log */}
      <Card
        title="Log Peringatan Kapasitas (Capacity Alerts)"
        subtitle={
          listQuery.data?.nextCursor
            ? `Menampilkan ${LIST_LIMIT} peringatan terbaru`
            : "Diurutkan dari yang terbaru"
        }
      >
        <Table
          head={["Waktu", "Tingkat Peringatan", "Kamera CCTV", "Tingkat (Severity)", "Bukti"]}
          rows={(listQuery.data?.rows ?? []).map((e) => [
            fmtLocalTime(e.time),
            <span key="lvl" className="font-extrabold text-forest uppercase text-xs">
              {(e.data.level as string) || "Kapasitas Melebihi Batas"}
            </span>,
            e.cameraName ?? e.cameraId ?? "—",
            <SeverityBadge key="sev" severity={e.severity} />,
            <EvidenceButton
              key="ev"
              snapshotUrl={e.snapshotUrl}
              clipUrl={e.clipUrl}
              title={`${e.cameraName ?? e.cameraId ?? "Resto"} · ${date} ${fmtLocalTime(e.time)} WIB`}
            />,
          ])}
          empty={
            listQuery.isLoading
              ? "Memuat log kapasitas..."
              : (listQuery.data?.rows ?? []).length === 0
              ? `Tidak ada peringatan kapasitas restoran pada ${date}.`
              : undefined
          }
        />
      </Card>
    </>
  );
}
