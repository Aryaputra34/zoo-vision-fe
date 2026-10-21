"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Store, UserX, Clock, Users } from "lucide-react";
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
} from "@/components/ui";
import { HourlyBars, AreaTabs } from "@/components/client";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { LivePausedBadge } from "@/components/LivePausedBadge";
import { AreaSection, AREA_SUBTITLE, AREA_TITLE } from "@/components/area";
import { fillBuckets } from "@/lib/buckets";
import { fmtLocalTime, localDayRange, localHour, siteZoneLabel } from "@/lib/time";
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

  const fmtDur = (sec: number) => (sec > 0 ? `${Math.floor(sec / 60)} mnt ${sec % 60} dtk` : "—");

  return (
    <>
      <PageHeader title={AREA_TITLE} subtitle={AREA_SUBTITLE} date={date}>
        <CsvLink path="/api/v1/exports/events.csv" params={{ ...day, types: TYPES }} />
      </PageHeader>

      <AreaTabs />

      {isToday && cashierCameras.length > 0 && (
        <AreaSection title="Sekarang" note={<LivePausedBadge />}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {cashierCameras.map((cam) => {
              const status = liveStatus[cam.id];
              const live = (status?.live as { state?: string; clerkCount?: number; visitorCount?: number }) ?? null;
              const offline = !status || !live;
              const isManned = !offline && (live.state === "MANNED" || (live.clerkCount ?? 0) > 0);
              return (
                <Link
                  key={cam.id}
                  href={`/live?cam=${encodeURIComponent(cam.id)}`}
                  className={`flex flex-col gap-3 rounded-[14px] bg-surface p-4 transition-transform hover:-translate-y-0.5 ${
                    offline ? "border border-[#cfc9b8]" : isManned ? "border border-line" : "border-2 border-[#e5483d]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-extrabold text-ink">{cam.name}</span>
                    {offline ? (
                      <span className="rounded-full bg-off-bg px-2.5 py-0.5 text-[11px] font-extrabold text-[#4b5550]">Kamera offline</span>
                    ) : isManned ? (
                      <span className="rounded-full bg-good-bg px-2.5 py-0.5 text-[11px] font-extrabold text-good">Dijaga</span>
                    ) : (
                      <span className="rounded-full bg-crit-bg px-2.5 py-0.5 text-[11px] font-extrabold text-crit-ink">Kasir Kosong</span>
                    )}
                  </span>
                  <span className="flex gap-6 text-sm">
                    <span>
                      <span className="text-muted">Staf</span>{" "}
                      <span className="text-lg font-extrabold tabular-nums">{offline ? "—" : live.clerkCount ?? 0}</span>
                    </span>
                    <span>
                      <span className="text-muted">Antre</span>{" "}
                      <span className="text-lg font-extrabold tabular-nums">{offline ? "—" : live.visitorCount ?? 0}</span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </AreaSection>
      )}

      <AreaSection title={isToday ? "Hari ini" : `Tanggal ${date}`}>
        <Tiles>
          <Tile
            label="Total loket kosong"
            icon={<UserX aria-hidden />}
            value={unattendedDayQuery.isLoading ? "…" : `${fmtNum(totals.unattendedMinutes)} mnt`}
            sub="semua loket"
          />
          <Tile label="Kosong terlama" icon={<Clock aria-hidden />} value={fmtDur(totals.maxAbsentSec)} sub="satu kali loket tanpa petugas" />
          <Tile label="Tunggu terlama" icon={<Users aria-hidden />} value={fmtDur(totals.maxWaitSec)} sub="pengunjung di depan loket" />
          <Tile
            label="Loket dipantau"
            icon={<Store aria-hidden />}
            value={camerasQuery.isLoading ? "…" : fmtNum(cashierCameras.length)}
            sub="kamera kehadiran kasir"
          />
        </Tiles>

        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Card title="Menit loket kosong per jam" className="lg:col-span-2">
            <HourlyBars data={hourlyData} unit=" m" series={[{ key: "unattendedMin", label: "Menit kosong" }]} />
          </Card>

          <Card title="Per loket" subtitle="Menit kosong dan jumlah peringatan">
            <Table
              head={["Loket", "Kosong", "Peringatan"]}
              align={["left", "right", "right"]}
              rows={deskSummary.map((d) => [
                <span key="c" className="font-bold text-forest">
                  {d.cameraName}
                </span>,
                `${fmtNum(d.unattendedMinutes)} mnt`,
                fmtNum(d.unattendedAlerts + d.waitingAlerts),
              ])}
              empty={unattendedDayQuery.isLoading ? "Memuat loket…" : deskSummary.length === 0 ? "Tidak ada data loket." : undefined}
            />
          </Card>
        </div>
      </AreaSection>

      <AreaSection title="Riwayat">
        <Card
          title="Peringatan loket"
          subtitle={listQuery.data?.nextCursor ? `Menampilkan ${LIST_LIMIT} peringatan terbaru` : "Diurutkan dari yang terbaru"}
          actions={
            <Link href="/events" className="text-[13px] font-bold text-forest hover:underline">
              Semua →
            </Link>
          }
        >
          <Table
            head={["Waktu", "Peringatan", "Loket", "Durasi", "Severity", "Bukti"]}
            rows={(listQuery.data?.rows ?? []).map((e) => [
              fmtLocalTime(e.time),
              <span key="t" className="font-bold text-ink">
                {e.type === "cashier_unattended" ? "Kasir kosong" : "Pengunjung menunggu"}
              </span>,
              e.cameraName ?? e.cameraId ?? "—",
              <span key="d" className="font-mono text-xs font-semibold text-ink">
                {fmtDur(Number(e.type === "cashier_unattended" ? e.data.absentSec ?? 0 : e.data.waitingSec ?? 0))}
              </span>,
              <SeverityBadge key="sev" severity={e.severity} />,
              <EvidenceButton
                key="ev"
                snapshotUrl={e.snapshotUrl}
                clipUrl={e.clipUrl}
                eventId={e.id}
                evidence={e.evidence}
                title={`${e.cameraName ?? e.cameraId ?? "Loket"} · ${date} ${fmtLocalTime(e.time)} ${siteZoneLabel()}`}
              />,
            ])}
            empty={
              listQuery.isLoading
                ? "Memuat peringatan…"
                : (listQuery.data?.rows ?? []).length === 0
                  ? `Tidak ada peringatan loket pada ${date}.`
                  : undefined
            }
          />
        </Card>
      </AreaSection>
    </>
  );
}
