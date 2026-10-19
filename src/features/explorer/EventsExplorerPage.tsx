"use client";

import { useState, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { useEventsList } from "@/api/generated/events/events";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import { useCamerasList } from "@/api/generated/cameras/cameras";
import { PageHeader, Card, Table, SeverityBadge } from "@/components/ui";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { fmtLocalTime, localDayRange } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import type { EventRowDto } from "@/api/generated/zooVisionAPI.schemas";

export function EventsExplorerPage({ date: picked }: { date?: string } = {}) {
  const today = useToday();
  const pickedDate = picked ?? today;
  const day = localDayRange(pickedDate);

  const usecasesQuery = useUsecasesList();
  const camerasQuery = useCamerasList();

  // Filters state
  const [selectedUseCase, setSelectedUseCase] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedCamera, setSelectedCamera] = useState<string>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");

  // Accumulated rows and cursor pagination
  const [accumulatedRows, setAccumulatedRows] = useState<EventRowDto[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const queryParams = useMemo(() => {
    return {
      from: day.from,
      to: day.to,
      useCase: selectedUseCase !== "ALL" ? selectedUseCase : undefined,
      types: selectedType !== "ALL" ? selectedType : undefined,
      cameraIds: selectedCamera !== "ALL" ? selectedCamera : undefined,
      severity: selectedSeverity !== "ALL" ? selectedSeverity : undefined,
      cursor,
      limit: 100,
    };
  }, [day.from, day.to, selectedUseCase, selectedType, selectedCamera, selectedSeverity, cursor]);

  const eventsQuery = useEventsList(queryParams);

  // Available event types based on selected useCase
  const availableTypes = useMemo(() => {
    const list: Array<{ type: string; useCaseLabel: string }> = [];
    for (const uc of usecasesQuery.data ?? []) {
      if (selectedUseCase === "ALL" || selectedUseCase === uc.id) {
        for (const ev of uc.events ?? []) {
          list.push({ type: ev.type, useCaseLabel: uc.label });
        }
      }
    }
    return list;
  }, [usecasesQuery.data, selectedUseCase]);

  // Handle loading more
  const handleLoadMore = () => {
    if (eventsQuery.data?.nextCursor) {
      if (eventsQuery.data?.rows) {
        const newRows = eventsQuery.data.rows;
        setAccumulatedRows((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const toAdd = newRows.filter((r) => !existingIds.has(r.id));
          return [...prev, ...toAdd];
        });
      }
      setCursor(eventsQuery.data.nextCursor);
    }
  };

  // Reset pagination when filters change
  const handleFilterChange = (setter: (v: string) => void, val: string) => {
    setter(val);
    setCursor(undefined);
    setAccumulatedRows([]);
  };

  // Merge rows when new page arrives
  const displayRows = useMemo(() => {
    const currentRows = eventsQuery.data?.rows ?? [];
    if (!cursor) {
      return currentRows;
    }
    const existingIds = new Set(accumulatedRows.map((r) => r.id));
    const merged = [...accumulatedRows];
    for (const r of currentRows) {
      if (!existingIds.has(r.id)) {
        merged.push(r);
      }
    }
    return merged;
  }, [eventsQuery.data?.rows, cursor, accumulatedRows]);

  const usecaseMap = new Map((usecasesQuery.data ?? []).map((u) => [u.id, u.label]));

  return (
    <>
      <PageHeader
        tag="Data Explorer"
        title="Pusat Log Kejadian (Events Explorer)"
        subtitle="Eksplorasi seluruh aliran kejadian AI vision lintas use-case secara generik dengan filter presisi dan bukti snapshot visual"
        date={pickedDate}
      >
        <CsvLink
          path="/api/v1/exports/events.csv"
          params={{
            from: day.from,
            to: day.to,
            useCase: selectedUseCase !== "ALL" ? selectedUseCase : undefined,
            types: selectedType !== "ALL" ? selectedType : undefined,
            cameraIds: selectedCamera !== "ALL" ? selectedCamera : undefined,
            severity: selectedSeverity !== "ALL" ? selectedSeverity : undefined,
          }}
        />
      </PageHeader>

      {/* Filter Toolbar */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Use Case Filter */}
        <div className="relative">
          <select
            value={selectedUseCase}
            onChange={(e) => {
              handleFilterChange(setSelectedUseCase, e.target.value);
              setSelectedType("ALL");
            }}
            aria-label="Filter Use-Case"
            className="w-full appearance-none rounded-2xl border border-line bg-surface py-2.5 px-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none"
          >
            <option value="ALL">Semua Use-Case Analitik</option>
            {(usecasesQuery.data ?? []).map((uc) => (
              <option key={uc.id} value={uc.id}>
                {uc.label} ({uc.id})
              </option>
            ))}
          </select>
        </div>

        {/* Event Type Filter */}
        <div className="relative">
          <select
            value={selectedType}
            onChange={(e) => handleFilterChange(setSelectedType, e.target.value)}
            aria-label="Filter Tipe Kejadian"
            className="w-full appearance-none rounded-2xl border border-line bg-surface py-2.5 px-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none"
          >
            <option value="ALL">Semua Tipe Kejadian</option>
            {availableTypes.map((t) => (
              <option key={t.type} value={t.type}>
                {t.type}
              </option>
            ))}
          </select>
        </div>

        {/* Camera Filter */}
        <div className="relative">
          <select
            value={selectedCamera}
            onChange={(e) => handleFilterChange(setSelectedCamera, e.target.value)}
            aria-label="Filter Kamera CCTV"
            className="w-full appearance-none rounded-2xl border border-line bg-surface py-2.5 px-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none"
          >
            <option value="ALL">Semua Kamera CCTV</option>
            {(camerasQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>

        {/* Severity Filter */}
        <div className="relative">
          <select
            value={selectedSeverity}
            onChange={(e) => handleFilterChange(setSelectedSeverity, e.target.value)}
            aria-label="Filter Tingkat Keparahan"
            className="w-full appearance-none rounded-2xl border border-line bg-surface py-2.5 px-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none"
          >
            <option value="ALL">Semua Tingkat Keparahan</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <Card
        title={`Daftar Kejadian (${displayRows.length} Ditampilkan)`}
        subtitle="Diurutkan kronologis dari waktu terbaru"
      >
        <Table
          head={[
            "Waktu",
            "Use Case & Tipe",
            "Kamera CCTV",
            "Tingkat (Severity)",
            "Data Deteksi (Generik)",
            "Bukti Visual",
          ]}
          rows={displayRows.map((e) => {
            const dataEntries = Object.entries(e.data ?? {});

            return [
              fmtLocalTime(e.time),

              <div key="type" className="flex flex-col">
                <span className="font-extrabold text-forest">{e.type.replace(/_/g, " ")}</span>
                <span className="text-[10px] text-muted">
                  {usecaseMap.get(e.useCase) ?? e.useCase}
                </span>
              </div>,

              <span key="cam" className="text-xs font-semibold text-ink">
                {e.cameraName ?? e.cameraId ?? "—"}
              </span>,

              <SeverityBadge key="sev" severity={e.severity} />,

              <div key="data" className="flex flex-wrap gap-1 max-w-xs">
                {dataEntries.length > 0 ? (
                  dataEntries.map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono font-bold text-ink-2"
                    >
                      {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </span>
                  ))
                ) : (
                  <span className="text-muted text-xs">—</span>
                )}
              </div>,

              <EvidenceButton
                key="ev"
                snapshotUrl={e.snapshotUrl}
                clipUrl={e.clipUrl}
                title={`${e.cameraName ?? e.cameraId ?? "CCTV"} · ${pickedDate} ${fmtLocalTime(e.time)} WIB`}
              />,
            ];
          })}
          empty={
            eventsQuery.isLoading
              ? "Memuat log kejadian..."
              : displayRows.length === 0
              ? `Tidak ada kejadian yang cocok dengan kriteria filter pada tanggal ${pickedDate}.`
              : undefined
          }
        />

        {eventsQuery.data?.nextCursor && (
          <div className="mt-6 flex justify-center border-t border-line/60 pt-4">
            <button
              type="button"
              disabled={eventsQuery.isFetching}
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-2.5 text-xs font-black text-forest shadow-sm transition hover:border-lime hover:bg-lime/10 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${eventsQuery.isFetching ? "animate-spin" : ""}`} />
              {eventsQuery.isFetching ? "Memuat Halaman Berikutnya..." : "Muat Lebih Banyak (Load More)"}
            </button>
          </div>
        )}
      </Card>
    </>
  );
}
