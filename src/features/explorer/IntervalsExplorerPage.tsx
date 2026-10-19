"use client";

import { useState, useMemo } from "react";
import { useIntervalsList } from "@/api/generated/intervals/intervals";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import { useCamerasList } from "@/api/generated/cameras/cameras";
import { PageHeader, Card, Table } from "@/components/ui";
import { CsvLink } from "@/components/CsvLink";
import { fmtLocalTime, localDayRange } from "@/lib/time";
import { useToday } from "@/lib/useToday";

export function IntervalsExplorerPage({ date: picked }: { date?: string } = {}) {
  const today = useToday();
  const pickedDate = picked ?? today;
  const day = localDayRange(pickedDate);

  const usecasesQuery = useUsecasesList();
  const camerasQuery = useCamerasList();

  // Extract all available interval kinds from all use cases plus system
  const availableKinds = useMemo(() => {
    const list: Array<{ kind: string; label: string; useCase: string }> = [
      { kind: "camera_offline", label: "Downtime Kamera (camera_offline)", useCase: "system" },
    ];
    for (const uc of usecasesQuery.data ?? []) {
      for (const inv of uc.intervals ?? []) {
        if (!list.some((item) => item.kind === inv.kind)) {
          list.push({
            kind: inv.kind,
            label: `${inv.kind} (${uc.label})`,
            useCase: uc.id,
          });
        }
      }
    }
    return list;
  }, [usecasesQuery.data]);

  const [selectedKind, setSelectedKind] = useState<string>("desk_unattended");
  const [selectedCamera, setSelectedCamera] = useState<string>("ALL");

  // Determine active useCase for query
  const activeUseCase = useMemo(() => {
    const match = availableKinds.find((k) => k.kind === selectedKind);
    return match?.useCase;
  }, [availableKinds, selectedKind]);

  const intervalsQuery = useIntervalsList({
    from: day.from,
    to: day.to,
    kind: selectedKind || undefined,
    useCase: activeUseCase,
    cameraIds: selectedCamera !== "ALL" ? selectedCamera : undefined,
    limit: 300,
  });

  const intervals = useMemo(() => intervalsQuery.data?.rows ?? [], [intervalsQuery.data?.rows]);

  // Group intervals by camera for Timeline visualization
  const dayStartMs = Date.parse(day.from);
  const dayEndMs = Date.parse(day.to);
  const dayTotalMs = dayEndMs - dayStartMs;

  const cameraTimelineMap = useMemo(() => {
    const map = new Map<string, typeof intervals>();
    for (const inv of intervals) {
      const cam = inv.cameraName ?? inv.cameraId ?? "Kamera Umum";
      const list = map.get(cam) ?? [];
      list.push(inv);
      map.set(cam, list);
    }
    return map;
  }, [intervals]);

  const cameras = camerasQuery.data ?? [];

  return (
    <>
      <PageHeader
        tag="Data Explorer"
        title="Garis Waktu Durasi (Interval Timeline)"
        subtitle="Visualisasi rentang interval durasi operasional per kamera: kasir kosong, sesi meja, hingga downtime konektivitas sensor"
        date={pickedDate}
      >
        <CsvLink
          path="/api/v1/exports/intervals.csv"
          params={{
            from: day.from,
            to: day.to,
            kind: selectedKind || undefined,
            useCase: activeUseCase,
            cameraIds: selectedCamera !== "ALL" ? selectedCamera : undefined,
          }}
        />
      </PageHeader>

      {/* Control bar */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="relative">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2 mb-1">
            Pilih Jenis Interval (Kind)
          </label>
          <select
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface py-2.5 px-4 text-xs font-bold text-ink focus:border-lime focus:outline-none"
          >
            {availableKinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2 mb-1">
            Filter Kamera CCTV
          </label>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface py-2.5 px-4 text-xs font-bold text-ink focus:border-lime focus:outline-none"
          >
            <option value="ALL">Semua Kamera CCTV</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Visual Timeline Bar Chart per Camera */}
      <div className="mb-6">
        <Card
          title={`Garis Waktu 24 Jam: ${selectedKind}`}
          subtitle="Distribusi horizontal durasi kejadian dalam rentang jam operasional (00:00 - 24:00 WIB)"
        >
          {cameraTimelineMap.size > 0 ? (
            <div className="space-y-4">
              {/* Hour ruler */}
              <div className="flex justify-between border-b border-line pb-1 text-[10px] font-bold text-muted">
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
                <span>24:00 WIB</span>
              </div>

              {Array.from(cameraTimelineMap.entries()).map(([camName, invList]) => (
                <div key={camName} className="space-y-1">
                  <div className="text-xs font-bold text-ink flex items-center justify-between">
                    <span>{camName}</span>
                    <span className="text-[10px] text-muted">{invList.length} interval tercatat</span>
                  </div>

                  {/* 24-Hour Timeline Bar */}
                  <div className="relative h-6 w-full overflow-hidden rounded-xl bg-surface-2 border border-line/60">
                    {invList.map((inv) => {
                      const startT = Date.parse(inv.start);
                      const endT = inv.end ? Date.parse(inv.end) : dayEndMs;
                      const leftPct = Math.max(0, Math.min(100, ((startT - dayStartMs) / dayTotalMs) * 100));
                      const widthPct = Math.max(0.5, Math.min(100 - leftPct, ((endT - startT) / dayTotalMs) * 100));
                      const isOpen = inv.end === null;

                      return (
                        <div
                          key={inv.id}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          title={`${camName}: ${fmtLocalTime(inv.start)} - ${
                            inv.end ? fmtLocalTime(inv.end) : "Sedang Berlangsung"
                          } (${inv.durationSec ? `${inv.durationSec}s` : "Terbuka"})`}
                          className={`absolute top-0 bottom-0 rounded-md transition hover:brightness-125 ${
                            isOpen ? "bg-amber-500 animate-pulse" : "bg-forest"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs font-bold text-muted">
              Tidak ada interval {selectedKind} pada tanggal {pickedDate}.
            </div>
          )}
        </Card>
      </div>

      {/* Interval Records Table */}
      <Card
        title={`Rincian Rekaman Interval (${intervals.length} Interval)`}
        subtitle="Daftar lengkap interval dengan durasi dan alasan penutupan"
      >
        <Table
          head={[
            "Waktu Mulai",
            "Waktu Selesai",
            "Durasi",
            "Kamera CCTV",
            "Subject / Target",
            "Status / Alasan Tutup",
          ]}
          rows={intervals.map((inv) => [
            fmtLocalTime(inv.start),
            inv.end ? (
              fmtLocalTime(inv.end)
            ) : (
              <span key="open" className="font-bold text-amber-600">
                Sedang Berlangsung
              </span>
            ),
            inv.durationSec !== null && inv.durationSec !== undefined ? (
              <span key="dur" className="font-mono text-xs font-bold text-forest">
                {Math.floor(inv.durationSec / 60)}m {inv.durationSec % 60}s
              </span>
            ) : (
              <span key="dur" className="text-muted text-xs">—</span>
            ),
            inv.cameraName ?? inv.cameraId ?? "—",
            inv.subjectId ? (
              <span key="sub" className="text-xs font-bold text-ink">
                {inv.subjectId}
              </span>
            ) : (
              <span key="sub" className="text-muted text-xs">—</span>
            ),
            <span key="reason" className="text-xs font-semibold text-ink-2">
              {inv.endReason || (inv.end ? "Normal" : "Terbuka")}
            </span>,
          ])}
          empty={
            intervalsQuery.isLoading
              ? "Memuat interval..."
              : intervals.length === 0
              ? `Tidak ada interval yang ditemukan pada tanggal ${pickedDate}.`
              : undefined
          }
        />
      </Card>
    </>
  );
}
