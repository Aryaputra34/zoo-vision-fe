"use client";

import { useState, useMemo } from "react";
import {
  Server,
  Activity,
  AlertOctagon,
  RefreshCw,
  Cpu,
  WifiOff,
} from "lucide-react";
import { useSystemLogSystemEvents } from "@/api/generated/system-log/system-log";
import { useIntervalsList } from "@/api/generated/intervals/intervals";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader, Card, Table, SeverityBadge, Mono } from "@/components/ui";
import { CsvLink } from "@/components/CsvLink";
import { fmtLocalTime, localDayRange } from "@/lib/time";
import { useToday } from "@/lib/useToday";

export function SystemEventsPage() {
  const today = useToday();
  const [pickedDate, setPickedDate] = useState(today);
  const day = localDayRange(pickedDate);

  const [selectedType, setSelectedType] = useState<string>("ALL");

  // System events query
  const eventsQuery = useSystemLogSystemEvents({
    from: day.from,
    to: day.to,
    types: selectedType !== "ALL" ? selectedType : undefined,
    limit: 200,
  });

  // Camera downtime intervals query
  const downtimeQuery = useIntervalsList({
    from: day.from,
    to: day.to,
    useCase: "system",
    kind: "camera_offline",
    limit: 100,
  });

  // Combine and sort events and downtime intervals
  const combinedEntries = useMemo(() => {
    const list: Array<{
      id: string;
      time: string;
      type: string;
      source: "EVENT" | "DOWNTIME";
      severity: string;
      target: string;
      details: string;
    }> = [];

    for (const e of eventsQuery.data?.rows ?? []) {
      const dataStr = Object.entries(e.data ?? {})
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(", ");
      list.push({
        id: e.id,
        time: e.time,
        type: e.type,
        source: "EVENT",
        severity: e.severity,
        target: e.cameraName ?? e.cameraId ?? "AI Engine",
        details: dataStr || "—",
      });
    }

    if (selectedType === "ALL" || selectedType === "camera_offline") {
      for (const inv of downtimeQuery.data?.rows ?? []) {
        const dur = inv.durationSec ? `${Math.floor(inv.durationSec / 60)}m ${inv.durationSec % 60}s` : "Masih Offline";
        list.push({
          id: inv.id,
          time: inv.start,
          type: "camera_offline",
          source: "DOWNTIME",
          severity: "warning",
          target: inv.cameraName ?? inv.cameraId ?? "Kamera CCTV",
          details: `Downtime Sensor Kamera: ${dur} (${inv.endReason || "Koneksi terputus"})`,
        });
      }
    }

    return list.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  }, [eventsQuery.data, downtimeQuery.data, selectedType]);

  return (
    <RequireRole min="MANAGER">
      <PageHeader
        tag="Log Sistem & Mesin"
        title="Kejadian Sistem & Downtime Kamera (System Events)"
        subtitle="Log internal engine AI vision, error validasi model neural network, dan riwayat downtime konektivitas sensor"
        date={pickedDate}
      >
        <CsvLink
          path="/api/v1/system-log/system-events.csv"
          params={{
            from: day.from,
            to: day.to,
            types: selectedType !== "ALL" ? selectedType : undefined,
          }}
        />
      </PageHeader>

      {/* Filter toolbar */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2 mb-1">
            Filter Tipe Kejadian Sistem
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface py-2.5 px-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none"
          >
            <option value="ALL">Semua Kejadian Sistem & Downtime</option>
            <option value="camera_offline">Downtime Kamera (camera_offline)</option>
            <option value="engine_started">Engine Dimulai (engine_started)</option>
            <option value="events_dropped">Kejadian Terlewat (events_dropped)</option>
            <option value="config_rejected">Konfigurasi Ditolak (config_rejected)</option>
            <option value="model_validation_failed">Validasi Model Gagal (model_validation_failed)</option>
          </select>
        </div>
      </div>

      <Card
        title={`Daftar Kejadian Sistem (${combinedEntries.length} Baris)`}
        subtitle="Gabungan rekaman event pipeline dan durasi offline kamera sensor CCTV"
      >
        <Table
          head={[
            "Waktu",
            "Tipe Kejadian",
            "Sumber / Target",
            "Tingkat (Severity)",
            "Keterangan Data",
          ]}
          rows={combinedEntries.map((e) => [
            fmtLocalTime(e.time),

            <span key="type" className="font-mono text-xs font-bold text-forest">
              {e.type}
            </span>,

            <span key="target" className="text-xs font-semibold text-ink">
              {e.target}
            </span>,

            <SeverityBadge key="sev" severity={e.severity} />,

            <span key="det" className="text-xs text-ink-2 line-clamp-2" title={e.details}>
              {e.details}
            </span>,
          ])}
          empty={
            eventsQuery.isLoading || downtimeQuery.isLoading
              ? "Memuat log kejadian sistem..."
              : combinedEntries.length === 0
              ? `Tidak ada kejadian sistem pada tanggal ${pickedDate}.`
              : undefined
          }
        />
      </Card>
    </RequireRole>
  );
}
