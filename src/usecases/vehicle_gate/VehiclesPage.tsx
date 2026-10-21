"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Car, ArrowRightLeft, Clock, ShieldCheck } from "lucide-react";
import { useReportsEventStats } from "@/api/generated/reports/reports";
import { useEventsList } from "@/api/generated/events/events";
import { Card, PageHeader, Table, Tile, Tiles, Mono } from "@/components/ui";
import { HourlyBars, AreaTabs } from "@/components/client";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { AreaNow, AreaSection, AREA_SUBTITLE, AREA_TITLE } from "@/components/area";
import { fillBuckets } from "@/lib/buckets";
import { fmtLocalTime, localDayRange, localDaysRange, localHour, siteZoneLabel } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import { fmtNum } from "@/lib/util";

const TYPE = "vehicle_crossing";
const LIST_LIMIT = 200;
const VEHICLE_LABEL: Record<string, string> = { car: "Mobil", bus: "Bus", motorcycle: "Motor", truck: "Truk / logistik" };

export function VehiclesPage({ date: picked }: { date?: string }) {
  const today = useToday();
  const date = picked ?? today;
  const isToday = date === today;
  const day = localDayRange(date);
  const days14 = localDaysRange(date, 14);

  // Hourly crossing stats by direction
  const hoursQuery = useReportsEventStats({
    ...day,
    bucket: "hour",
    types: TYPE,
    groupBy: "data.direction",
  });

  // Type x Direction breakdown for the selected day
  const typeDirQuery = useReportsEventStats({
    ...day,
    bucket: "day",
    types: TYPE,
    groupBy: "data.vehicleType,data.direction",
  });

  // 14-day history for reconciliation
  const daysQuery = useReportsEventStats({
    ...days14,
    bucket: "day",
    types: TYPE,
    groupBy: "data.direction",
  });

  // Filter state for crossing event stream
  const [filterDirection, setFilterDirection] = useState<string>("ALL");
  const [filterVehicleType, setFilterVehicleType] = useState<string>("ALL");

  const whereFilter = useMemo(() => {
    const parts: string[] = [];
    if (filterDirection !== "ALL") parts.push(`data.direction:${filterDirection}`);
    if (filterVehicleType !== "ALL") parts.push(`data.vehicleType:${filterVehicleType}`);
    return parts.length > 0 ? parts.join(",") : undefined;
  }, [filterDirection, filterVehicleType]);

  const listQuery = useEventsList({
    ...day,
    types: TYPE,
    where: whereFilter,
    limit: LIST_LIMIT,
  });

  // Process Hourly Data with fillBuckets
  const hourlyData = useMemo(() => {
    const rawRows = hoursQuery.data?.rows ?? [];
    const filled = fillBuckets(
      rawRows,
      day.from,
      day.to,
      "hour",
      (bucketStart) => ({ bucketStart, count: 0, group: {} })
    );

    const map = new Map<number, { hour: number; entry: number; exit: number }>();
    for (const r of filled) {
      const h = Number(localHour(r.bucketStart));
      const existing = map.get(h) ?? { hour: h, entry: 0, exit: 0 };
      const group = r.group as Record<string, unknown> | undefined;
      const dir = group?.["data.direction"];
      if (dir === "ENTRY") existing.entry += r.count;
      else if (dir === "EXIT") existing.exit += r.count;
      map.set(h, existing);
    }

    return Array.from(map.values()).sort((a, b) => a.hour - b.hour);
  }, [hoursQuery.data, day.from, day.to]);

  // Aggregate totals
  const totals = useMemo(() => {
    let totalEntries = 0;
    let totalExits = 0;

    for (const r of hourlyData) {
      totalEntries += r.entry;
      totalExits += r.exit;
    }

    // Peak hour
    let peakHour = 0;
    let maxFlow = 0;
    for (const r of hourlyData) {
      if (r.entry > maxFlow) {
        maxFlow = r.entry;
        peakHour = r.hour;
      }
    }

    return {
      entries: totalEntries,
      exits: totalExits,
      inside: isToday ? totalEntries - totalExits : totalEntries - totalExits,
      peakHour: maxFlow > 0 ? peakHour : null,
      peakCount: maxFlow,
    };
  }, [hourlyData, isToday]);

  // Type x Direction breakdown matrix
  const vehicleMatrix = useMemo(() => {
    const matrix: Record<string, { entry: number; exit: number }> = {};
    for (const r of typeDirQuery.data?.rows ?? []) {
      const vType = (r.group?.["data.vehicleType"] as string) || "lainnya";
      const dir = r.group?.["data.direction"] as string;
      if (!matrix[vType]) matrix[vType] = { entry: 0, exit: 0 };
      if (dir === "ENTRY") matrix[vType].entry += r.count;
      if (dir === "EXIT") matrix[vType].exit += r.count;
    }
    return matrix;
  }, [typeDirQuery.data]);

  // 14-day summary list
  const historyDays = useMemo(() => {
    const dayMap = new Map<string, { date: string; entry: number; exit: number }>();
    for (const r of daysQuery.data?.rows ?? []) {
      const d = r.bucketStart.slice(0, 10);
      const cur = dayMap.get(d) ?? { date: d, entry: 0, exit: 0 };
      const dir = r.group?.["data.direction"];
      if (dir === "ENTRY") cur.entry += r.count;
      if (dir === "EXIT") cur.exit += r.count;
      dayMap.set(d, cur);
    }
    return Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [daysQuery.data]);

  return (
    <>
      <PageHeader
        title={AREA_TITLE}
        subtitle={AREA_SUBTITLE}
        date={date}
      >
        <CsvLink path="/api/v1/exports/events.csv" params={{ ...day, types: TYPE }} />
      </PageHeader>

      <AreaTabs />

      {isToday && (
        <AreaSection title="Sekarang">
          <AreaNow useCases={["vehicle_gate"]} />
        </AreaSection>
      )}

      <AreaSection title={isToday ? "Hari ini" : `Tanggal ${date}`}>
      <Tiles>
        <Tile
          label="Masuk"
          icon={<Car aria-hidden />}
          value={hoursQuery.isLoading ? "…" : fmtNum(totals.entries)}
          sub="melintasi garis hitung masuk"
        />
        <Tile
          label="Keluar"
          icon={<ArrowRightLeft aria-hidden />}
          value={hoursQuery.isLoading ? "…" : fmtNum(totals.exits)}
          sub="melintasi garis hitung keluar"
        />
        <Tile
          label={isToday ? "Di dalam taman" : "Selisih hari itu"}
          icon={<ShieldCheck aria-hidden />}
          value={hoursQuery.isLoading ? "…" : fmtNum(totals.inside)}
          sub="masuk − keluar"
        />
        <Tile
          label="Jam tersibuk"
          icon={<Clock aria-hidden />}
          value={totals.peakHour !== null ? `${totals.peakHour}:00 ${siteZoneLabel()}` : "—"}
          sub={
            totals.peakHour !== null
              ? `${fmtNum(totals.peakCount)} kendaraan masuk`
              : "belum ada lalu lintas"
          }
        />
      </Tiles>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-3">
        <Card
          title="Kendaraan per jam"
          className="lg:col-span-2"
        >
          <HourlyBars
            data={hourlyData}
            series={[
              { key: "entry", label: "Masuk" },
              { key: "exit", label: "Keluar" },
            ]}
          />
        </Card>

        <Card
          title="Jenis kendaraan"
        >
          <Table
            head={["Jenis", "Masuk", "Keluar"]}
            align={["left", "right", "right"]}
            rows={Object.entries(vehicleMatrix).map(([vType, counts]) => [
              <span key="t" className="font-bold text-forest capitalize">
                {VEHICLE_LABEL[vType] ?? vType}
              </span>,
              fmtNum(counts.entry),
              fmtNum(counts.exit),
            ])}
            empty={
              typeDirQuery.isLoading
                ? "Memuat…"
                : Object.keys(vehicleMatrix).length === 0
                ? "Belum ada kendaraan."
                : undefined
            }
          />
        </Card>
      </div>
      </AreaSection>

      <AreaSection title="Riwayat">
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Stream Crossing Log Table with Filters */}
          <Card
            title="Log lintasan"
            subtitle={
              listQuery.data?.nextCursor
                ? `Menampilkan ${LIST_LIMIT} kendaraan terbaru`
                : "Diurutkan dari yang terbaru"
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Arah"
                  value={filterDirection}
                  onChange={(e) => setFilterDirection(e.target.value)}
                  className="h-9 rounded-[10px] border border-[#cfc9b8] bg-surface px-2.5 text-[13px] font-semibold text-ink focus:border-forest focus:ring-2 focus:ring-lime/40 focus:outline-none"
                >
                  <option value="ALL">Semua arah</option>
                  <option value="ENTRY">Masuk</option>
                  <option value="EXIT">Keluar</option>
                </select>

                <select
                  aria-label="Jenis"
                  value={filterVehicleType}
                  onChange={(e) => setFilterVehicleType(e.target.value)}
                  className="h-9 rounded-[10px] border border-[#cfc9b8] bg-surface px-2.5 text-[13px] font-semibold text-ink focus:border-forest focus:ring-2 focus:ring-lime/40 focus:outline-none"
                >
                  <option value="ALL">Semua jenis</option>
                  <option value="car">Mobil</option>
                  <option value="bus">Bus</option>
                  <option value="motorcycle">Motor</option>
                  <option value="truck">Truk / logistik</option>
                </select>
              </div>
            }
          >
            <Table
              head={["Waktu", "Arah", "Jenis", "Kamera", "Tracker", "Bukti"]}
              rows={(listQuery.data?.rows ?? []).map((e) => [
                fmtLocalTime(e.time),
                e.data.direction === "ENTRY" ? (
                  <span key="dir" className="rounded-full bg-good-bg px-2 py-0.5 text-[11px] font-extrabold text-good">Masuk</span>
                ) : (
                  <span key="dir" className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-extrabold text-gold-ink">Keluar</span>
                ),
                <span key="vtype" className="font-semibold text-ink">
                  {VEHICLE_LABEL[e.data.vehicleType as string] ?? ((e.data.vehicleType as string) || "—")}
                </span>,
                e.cameraName ?? e.cameraId ?? "—",
                <span key="tr" className="text-xs">
                  <Mono>{typeof e.data.trackerId === "number" ? e.data.trackerId : "—"}</Mono>
                </span>,
                <EvidenceButton
                  key="ev"
                  snapshotUrl={e.snapshotUrl}
                  clipUrl={e.clipUrl}
                  eventId={e.id}
                  evidence={e.evidence}
                  title={`${e.cameraName ?? e.cameraId ?? "Gerbang"} · ${date} ${fmtLocalTime(e.time)} ${siteZoneLabel()}`}
                />,
              ])}
              empty={
                listQuery.isLoading
                  ? "Memuat data lintasan..."
                  : (listQuery.data?.rows ?? []).length === 0
                  ? `Tidak ada lintasan kendaraan yang cocok pada tanggal ${date}.`
                  : undefined
              }
            />
          </Card>
        </div>

        <div>
          <Card
            title="14 hari terakhir"
            subtitle="Untuk rekonsiliasi karcis masuk"
          >
            <Table
              head={["Tanggal", "Masuk", "Keluar"]}
              align={["left", "right", "right"]}
              rows={historyDays.map((r) => [
                <Link
                  key="d"
                  href={r.date === today ? "/vehicles" : `/vehicles?date=${r.date}`}
                  className={`font-bold transition-colors hover:text-lime-dark hover:underline ${
                    r.date === date ? "font-extrabold text-forest" : "text-ink-2"
                  }`}
                >
                  {r.date}
                </Link>,
                fmtNum(r.entry),
                fmtNum(r.exit),
              ])}
              empty={daysQuery.isLoading ? "Memuat…" : "Tidak ada riwayat."}
            />
          </Card>
        </div>
      </div>
      </AreaSection>
    </>
  );
}
