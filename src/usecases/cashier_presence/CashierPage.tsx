"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Store, UserX, Clock, Users, ShieldAlert, AlertTriangle } from "lucide-react";
import {
  useReportsEventStats,
  useReportsIntervalStats,
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
import { HourlyBars } from "@/components/client";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { LivePausedBadge } from "@/components/LivePausedBadge";
import { fillBuckets } from "@/lib/buckets";
import { fmtLocalTime, localDayRange, localHour } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import { fmtNum } from "@/lib/util";

const TYPES = "cashier_unattended,customer_waiting";
const LIST_LIMIT = 200;

export function CashierPage({ date: picked }: { date?: string }) {
  const today = useToday();
  const date = picked ?? today;
  const isToday = date === today;
  const day = localDayRange(date);

  // Unattended total per desk per day
  const unattendedDayQuery = useReportsIntervalStats({
    ...day,
    bucket: "day",
    kind: "desk_unattended",
    groupBy: "camera",
  });

  // Unattended per hour for distribution chart
  const unattendedHourQuery = useReportsIntervalStats({
    ...day,
    bucket: "hour",
    kind: "desk_unattended",
    groupBy: "camera",
  });

  // Alert counts per desk & type
  const alertStatsQuery = useReportsEventStats({
    ...day,
    bucket: "day",
    types: TYPES,
    groupBy: "camera,type",
  });

  // Longest absence
  const maxAbsenceQuery = useReportsEventStats({
    ...day,
    bucket: "day",
    types: "cashier_unattended",
    max: "absentSec",
  });

  // Longest wait
  const maxWaitQuery = useReportsEventStats({
    ...day,
    bucket: "day",
    types: "customer_waiting",
    max: "waitingSec",
  });

  // Alert events list
  const listQuery = useEventsList({
    ...day,
    types: TYPES,
    limit: LIST_LIMIT,
  });

  const camerasQuery = useCamerasList();
  const { cameras: liveStatus, paused } = useStatus();

  // Find cameras dedicated to cashier presence
  const cashierCameras = useMemo(() => {
    return (camerasQuery.data ?? []).filter((c) => c.useCase === "cashier_presence");
  }, [camerasQuery.data]);

  // Hourly unattended minutes chart data
  const hourlyData = useMemo(() => {
    const rawRows = unattendedHourQuery.data?.rows ?? [];
    const filled = fillBuckets(
      rawRows,
      day.from,
      day.to,
      "hour",
      (bucketStart) => ({ bucketStart, count: 0, totalSec: 0 })
    );

    const map = new Map<number, { hour: number; unattendedMin: number }>();
    for (const r of filled) {
      const h = Number(localHour(r.bucketStart));
      const cur = map.get(h) ?? { hour: h, unattendedMin: 0 };
      cur.unattendedMin += Math.round((r.totalSec ?? 0) / 60);
      map.set(h, cur);
    }

    return Array.from(map.values()).sort((a, b) => a.hour - b.hour);
  }, [unattendedHourQuery.data, day.from, day.to]);

  // Desk breakdown table
  const deskSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        cameraId: string;
        cameraName: string;
        unattendedMinutes: number;
        unattendedAlerts: number;
        waitingAlerts: number;
      }
    >();

    const camNameMap = new Map((camerasQuery.data ?? []).map((c) => [c.id, c.name]));

    for (const r of unattendedDayQuery.data?.rows ?? []) {
      const camId = r.cameraId || "default";
      const cur = map.get(camId) ?? {
        cameraId: camId,
        cameraName: camNameMap.get(camId) ?? camId,
        unattendedMinutes: 0,
        unattendedAlerts: 0,
        waitingAlerts: 0,
      };
      cur.unattendedMinutes += Math.round((r.totalSec ?? 0) / 60);
      map.set(camId, cur);
    }

    for (const r of alertStatsQuery.data?.rows ?? []) {
      const camId = (r.group?.["camera"] as string) || "default";
      const type = r.group?.["type"] as string;
      const cur = map.get(camId) ?? {
        cameraId: camId,
        cameraName: camNameMap.get(camId) ?? camId,
        unattendedMinutes: 0,
        unattendedAlerts: 0,
        waitingAlerts: 0,
      };
      if (type === "cashier_unattended") cur.unattendedAlerts += r.count;
      if (type === "customer_waiting") cur.waitingAlerts += r.count;
      map.set(camId, cur);
    }

    return Array.from(map.values());
  }, [unattendedDayQuery.data, alertStatsQuery.data, camerasQuery.data]);

  // Aggregate totals
  const totals = useMemo(() => {
    let totalUnattendedSec = 0;
    for (const r of unattendedDayQuery.data?.rows ?? []) {
      totalUnattendedSec += r.totalSec ?? 0;
    }

    let maxAbsentSec = 0;
    for (const r of maxAbsenceQuery.data?.rows ?? []) {
      if (typeof r.max === "number" && r.max > maxAbsentSec) maxAbsentSec = r.max;
    }

    let maxWaitSec = 0;
    for (const r of maxWaitQuery.data?.rows ?? []) {
      if (typeof r.max === "number" && r.max > maxWaitSec) maxWaitSec = r.max;
    }

    return {
      unattendedMinutes: Math.round(totalUnattendedSec / 60),
      maxAbsentSec,
      maxWaitSec,
    };
  }, [unattendedDayQuery.data, maxAbsenceQuery.data, maxWaitQuery.data]);

  return (
    <>
      <PageHeader
        tag="Taman Safari Bogor · Loket Tiket"
        title="Pengawasan Kasir & Waktu Antre Loket"
        subtitle="Analitik AI sensor kehadiran staf kasir loket, durasi loket tak berpenjaga, dan kepuasan antrean pengunjung"
        date={date}
      >
        <CsvLink path="/api/v1/exports/events.csv" params={{ ...day, types: TYPES }} />
      </PageHeader>

      <Tiles>
        <Tile
          label="Total Kasir Tak Berpenjaga"
          icon={<UserX aria-hidden />}
          value={unattendedDayQuery.isLoading ? "…" : `${totals.unattendedMinutes} Menit`}
          sub="Akumulasi seluruh loket aktif"
        />
        <Tile
          label="Absen Staf Terlama"
          icon={<Clock aria-hidden />}
          value={
            totals.maxAbsentSec > 0
              ? `${Math.floor(totals.maxAbsentSec / 60)}m ${totals.maxAbsentSec % 60}s`
              : "—"
          }
          sub="Durasi tunggal loket kosong terpanjang"
        />
        <Tile
          label="Waktu Antre Pengunjung Terlama"
          icon={<Users aria-hidden />}
          value={
            totals.maxWaitSec > 0
              ? `${Math.floor(totals.maxWaitSec / 60)}m ${totals.maxWaitSec % 60}s`
              : "—"
          }
          sub="Batas toleransi antre di depan kasir"
        />
        <Tile
          label="Status Operasional Kasir"
          icon={<Store aria-hidden />}
          value={cashierCameras.length > 0 ? `${cashierCameras.length} Loket` : "Semua Kasir"}
          sub="Terhubung ke sensor AI CCTV"
        />
      </Tiles>

      {/* Live Cashier Desks Real-Time Monitor */}
      {isToday && cashierCameras.length > 0 && (
        <div className="mb-6">
          <Card
            title="Status Langsung Loket Kasir (Live State)"
            subtitle="Telemetri kehadiran staf loket dan antrean saat ini"
            actions={<LivePausedBadge />}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cashierCameras.map((cam) => {
                const status = liveStatus[cam.id];
                const live = (status?.live as {
                  state?: string;
                  clerkCount?: number;
                  visitorCount?: number;
                }) ?? null;

                if (!status || !live) {
                  return (
                    <div
                      key={cam.id}
                      className="rounded-2xl border border-line bg-surface p-4 shadow-sm"
                    >
                      <div className="text-xs font-bold text-ink">{cam.name}</div>
                      <div className="mt-2 text-xl font-black text-muted">—</div>
                      <div className="mt-1 text-[11px] font-bold text-zinc-400">Kamera offline</div>
                    </div>
                  );
                }

                const isManned = live.state === "MANNED" || (live.clerkCount ?? 0) > 0;

                return (
                  <div
                    key={cam.id}
                    className={`rounded-2xl border p-4 shadow-sm transition ${
                      isManned
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-amber-200 bg-amber-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-ink">{cam.name}</span>
                      {isManned ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                          Berpenjaga
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                          Kasir Kosong
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-muted block text-[10px] uppercase font-bold">Staf</span>
                        <span className="text-base font-black text-forest">{live.clerkCount ?? 0} Orang</span>
                      </div>
                      <div>
                        <span className="text-muted block text-[10px] uppercase font-bold">Antrean</span>
                        <span className="text-base font-black text-ink">{live.visitorCount ?? 0} Orang</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Hourly Chart and Desk Breakdown */}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-3">
        <Card
          title="Durasi Kasir Kosong per Jam"
          subtitle="Distribusi waktu ketiadaan staf kasir per jam operasional (Menit)"
          className="lg:col-span-2"
        >
          <HourlyBars
            data={hourlyData}
            unit=" m"
            series={[{ key: "unattendedMin", label: "Menit Kosong" }]}
          />
        </Card>

        <Card
          title="Rekapitulasi per Loket Kasir"
          subtitle="Total menit kosong & jumlah peringatan antre"
        >
          <Table
            head={["Loket", "Kosong", "Peringatan"]}
            align={["left", "right", "right"]}
            rows={deskSummary.map((d) => [
              <span key="c" className="font-bold text-xs text-forest">
                {d.cameraName}
              </span>,
              `${d.unattendedMinutes} m`,
              fmtNum(d.unattendedAlerts + d.waitingAlerts),
            ])}
            empty={
              unattendedDayQuery.isLoading
                ? "Memuat loket..."
                : deskSummary.length === 0
                ? "Tidak ada data loket."
                : undefined
            }
          />
        </Card>
      </div>

      {/* Incident List */}
      <Card
        title="Log Peringatan Insiden Kasir & Antrean"
        subtitle={
          listQuery.data?.nextCursor
            ? `Menampilkan ${LIST_LIMIT} peringatan terbaru`
            : "Diurutkan dari yang terbaru"
        }
      >
        <Table
          head={["Waktu", "Jenis Peringatan", "Loket Kasir", "Durasi", "Tingkat (Severity)", "Bukti"]}
          rows={(listQuery.data?.rows ?? []).map((e) => [
            fmtLocalTime(e.time),
            <span key="t" className="font-extrabold text-forest">
              {e.type === "cashier_unattended" ? "Kasir Tak Berpenjaga" : "Pengunjung Menunggu Lama"}
            </span>,
            e.cameraName ?? e.cameraId ?? "—",
            <span key="d" className="font-mono text-xs font-bold text-ink">
              {e.type === "cashier_unattended"
                ? `${e.data.absentSec ?? 0}s`
                : `${e.data.waitingSec ?? 0}s`}
            </span>,
            <SeverityBadge key="sev" severity={e.severity} />,
            <EvidenceButton
              key="ev"
              snapshotUrl={e.snapshotUrl}
              clipUrl={e.clipUrl}
              title={`${e.cameraName ?? e.cameraId ?? "Loket"} · ${date} ${fmtLocalTime(e.time)} WIB`}
            />,
          ])}
          empty={
            listQuery.isLoading
              ? "Memuat insiden..."
              : (listQuery.data?.rows ?? []).length === 0
              ? `Tidak ada peringatan insiden kasir pada ${date}.`
              : undefined
          }
        />
      </Card>
    </>
  );
}
