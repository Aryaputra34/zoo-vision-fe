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
import { OccupancyChart, AreaTabs } from "@/components/client";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { LivePausedBadge } from "@/components/LivePausedBadge";
import { AreaNow, AreaSection, AREA_SUBTITLE, AREA_TITLE } from "@/components/area";
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
      <PageHeader title={AREA_TITLE} subtitle={AREA_SUBTITLE} date={date}>
        <CsvLink path="/api/v1/exports/events.csv" params={{ ...day, types: "capacity_alert" }} />
      </PageHeader>

      <AreaTabs />

      {isToday && (
        <AreaSection title="Sekarang" note={<LivePausedBadge />}>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <AreaNow stacked useCases={["restaurant_counter", "restaurant_table"]} />
            <Card title="Denah meja">
              {liveTables.length === 0 ? (
                <p className="text-sm text-muted">Belum ada data meja dari kamera.</p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-4 text-xs font-semibold text-ink-2">
                    <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-forest" />Terisi</span>
                    <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] border-[1.5px] border-lime bg-surface" />Kosong</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {liveTables.map((t) => {
                      const isOccupied = t.state === "OCCUPIED" || t.state === "SEATED";
                      return (
                        <div
                          key={t.id}
                          className={`flex flex-col items-center rounded-[10px] px-2 py-2.5 text-center ${
                            isOccupied ? "bg-forest text-white" : "border-[1.5px] border-lime bg-surface text-forest"
                          }`}
                        >
                          <span className="text-[13px] font-extrabold">{t.name}</span>
                          <span className={`text-[11px] font-semibold ${isOccupied ? "text-[#cfe3d4]" : "text-muted"}`}>
                            {isOccupied ? "Terisi" : "Kosong"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Card>
          </div>
        </AreaSection>
      )}

      <AreaSection title={isToday ? "Hari ini" : `Tanggal ${date}`}>
        <Tiles>
          <Tile
            label="Puncak tamu"
            icon={<Users aria-hidden />}
            value={occupancyQuery.isLoading ? "…" : `${fmtNum(totals.peakGuests)} orang`}
            sub={totals.peakTime !== "—" ? `pukul ${totals.peakTime} WIB` : "belum ada kunjungan"}
          />
          <Tile
            label="Durasi padat"
            icon={<Clock aria-hidden />}
            value={busyMinutesQuery.isLoading ? "…" : `${fmtNum(totals.busyMinutes)} mnt`}
            sub={`di atas ${WARNING_CAPACITY} tamu`}
          />
          <Tile
            label="Meja terlayani"
            icon={<Utensils aria-hidden />}
            value={tableSessionQuery.isLoading ? "…" : fmtNum(totals.tablesSeated)}
            sub="sesi meja tercatat"
          />
          <Tile
            label="Rata-rata makan"
            icon={<Clock aria-hidden />}
            value={totals.avgStayMinutes > 0 ? `${totals.avgStayMinutes} mnt` : "—"}
            sub="per sesi meja"
          />
        </Tiles>

        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Card
            title="Kurva okupansi"
            subtitle={`Puncak per 5 menit · batas peringatan ${WARNING_CAPACITY}, maksimal ${MAX_CAPACITY} tamu`}
            className="lg:col-span-2"
          >
            {chartData.length > 0 ? (
              <OccupancyChart data={chartData} warning={WARNING_CAPACITY} max={MAX_CAPACITY} />
            ) : (
              <div className="py-16 text-center text-sm text-muted">Tidak ada data okupansi pada tanggal {date}.</div>
            )}
          </Card>

          <Card
            title="Peringatan kapasitas"
            subtitle={listQuery.data?.nextCursor ? `${LIST_LIMIT} peringatan terbaru` : undefined}
            actions={
              <Link href="/events" className="text-[13px] font-bold text-forest hover:underline">
                Semua →
              </Link>
            }
          >
            <Table
              head={["Waktu", "Severity", "Bukti"]}
              rows={(listQuery.data?.rows ?? []).map((e) => [
                fmtLocalTime(e.time),
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
                  ? "Memuat peringatan…"
                  : (listQuery.data?.rows ?? []).length === 0
                    ? `Tidak ada peringatan kapasitas pada ${date}.`
                    : undefined
              }
            />
          </Card>
        </div>
      </AreaSection>
    </>
  );
}
