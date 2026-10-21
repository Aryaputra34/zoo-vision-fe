"use client";

import Link from "next/link";
import { Clock, Hourglass, Ticket, Undo2 } from "lucide-react";
import { useReportsEventStats } from "@/api/generated/reports/reports";
import { useEventsList } from "@/api/generated/events/events";
import { Card, Mono, PageHeader, Table, Tile, Tiles } from "@/components/ui";
import { AreaNow, AreaSection, AREA_SUBTITLE, AREA_TITLE } from "@/components/area";
import { HourlyBars, AreaTabs } from "@/components/client";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { fmtLocalTime, localDayRange, localDaysRange, siteZoneLabel } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import { fmtNum } from "@/lib/util";
import { DIRECTION, ridesView } from "./rides-view";

const TYPE = "horse_crossing";
const LIST_LIMIT = 200;

// The reference page for the use-case reports: numbers from /reports, rows from /events, evidence from the
// row URLs, CSV from /exports. data.changed refetches all three (src/live), so there is no polling here.
// Without a date it follows today, across midnight.
export function RidesPage({ date: picked }: { date?: string }) {
  const today = useToday();
  const date = picked ?? today;
  const isToday = date === today;
  const day = localDayRange(date);
  const days14 = localDaysRange(date, 14);

  const hours = useReportsEventStats({ ...day, bucket: "hour", types: TYPE, groupBy: DIRECTION });
  const days = useReportsEventStats({ ...days14, bucket: "day", types: TYPE, groupBy: DIRECTION });
  const list = useEventsList({ ...day, types: TYPE, limit: LIST_LIMIT });

  const view = hours.data && days.data ? ridesView(hours.data.rows, days.data.rows, date, days14.from, days14.to) : null;
  const error = (hours.error ?? days.error ?? list.error) as Error | null;
  const value = (n: number | undefined) => (view ? fmtNum(n ?? 0) : "…");

  return (
    <>
      <PageHeader title={AREA_TITLE} subtitle={AREA_SUBTITLE} date={date}>
        <CsvLink path="/api/v1/exports/events.csv" params={{ ...day, types: TYPE }} />
      </PageHeader>

      <AreaTabs />

      {error && (
        <div role="alert" className="mb-4 rounded-2xl border border-crit/25 bg-crit-bg px-4 py-2.5 text-xs font-bold text-crit-ink">
          Gagal memuat data wahana: {error.message}
        </div>
      )}

      {isToday && (
        <AreaSection title="Sekarang">
          <AreaNow useCases={["horse_riding"]} />
        </AreaSection>
      )}

      <AreaSection title={isToday ? "Hari ini" : `Tanggal ${date}`}>
      <Tiles>
        <Tile label="Berangkat" icon={<Ticket aria-hidden />} value={value(view?.departures)} sub="kuda melintasi garis berangkat" />
        <Tile label="Kembali" icon={<Undo2 aria-hidden />} value={value(view?.returns)} sub="selesai satu putaran" />
        <Tile
          label={isToday ? "Di lintasan" : "Selisih akhir hari"}
          icon={<Hourglass aria-hidden />}
          value={value(view?.onTrack)}
          sub={isToday ? "berangkat − kembali" : "belum tercatat kembali saat tutup"}
        />
        <Tile
          label="Jam tersibuk"
          icon={<Clock aria-hidden />}
          value={!view ? "…" : view.busiestHour ? `${view.busiestHour}:00 ${siteZoneLabel()}` : "—"}
          sub={
            view?.busiestHour
              ? `${view.hourly.find((h) => h.hour === view.busiestHour)?.departures ?? 0} kali berangkat`
              : "belum ada aktivitas"
          }
        />
      </Tiles>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-3">
        <Card title="Aktivitas per jam" className="lg:col-span-2">
          <HourlyBars
            data={view?.hourly ?? []}
            series={[
              { key: "departures", label: "Berangkat" },
              { key: "returns", label: "Kembali" },
            ]}
          />
        </Card>
        <Card title="14 hari terakhir" subtitle="Untuk rekonsiliasi tiket">
          <Table
            maxH="max-h-64"
            head={["Tanggal", "Berangkat", "Kembali"]}
            align={["left", "right", "right"]}
            rows={(view?.days ?? []).map((r) => [
              <Link
                key="d"
                href={r.date === today ? "/rides" : `/rides?date=${r.date}`}
                className={`font-bold transition-colors hover:text-lime-dark hover:underline ${r.date === date ? "font-extrabold text-forest" : "text-ink-2"}`}
              >
                {r.date}
              </Link>,
              fmtNum(r.departures),
              fmtNum(r.returns),
            ])}
            empty={view ? "Tidak ada data." : "Memuat…"}
          />
        </Card>
      </div>
      </AreaSection>

      <AreaSection title="Riwayat">
      <Card
        title="Log lintasan"
        subtitle={list.data?.nextCursor ? `Menampilkan ${LIST_LIMIT} lintasan terbaru` : "Diurutkan dari yang terbaru"}
      >
        <Table
          head={["Waktu", "Arah", "Kamera", "Tracker", "Bukti"]}
          rows={(list.data?.rows ?? []).map((e) => [
            fmtLocalTime(e.time),
            e.data.direction === "DEPARTURE" ? (
              <span key="d" className="rounded-full bg-good-bg px-2 py-0.5 text-[11px] font-extrabold text-good">Berangkat</span>
            ) : (
              <span key="d" className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-extrabold text-gold-ink">Kembali</span>
            ),
            e.cameraName ?? e.cameraId ?? "—",
            <Mono key="t">{typeof e.data.trackerId === "number" ? e.data.trackerId : "—"}</Mono>,
            <EvidenceButton
              key="v"
              snapshotUrl={e.snapshotUrl}
              clipUrl={e.clipUrl}
              title={`${e.cameraName ?? e.cameraId ?? "Kamera"} · ${date} ${fmtLocalTime(e.time)} ${siteZoneLabel()}`}
            />,
          ])}
          empty={list.isPending ? "Memuat…" : `Tidak ada lintasan wahana kuda pada ${date}.`}
        />
      </Card>
      </AreaSection>
    </>
  );
}
