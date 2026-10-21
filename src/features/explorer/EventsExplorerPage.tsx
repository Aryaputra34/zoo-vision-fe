"use client";

import { useState, useMemo, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Video } from "lucide-react";
import { useEventsList } from "@/api/generated/events/events";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import { useCamerasList } from "@/api/generated/cameras/cameras";
import { PageHeader, SeverityBadge } from "@/components/ui";
import { CsvLink } from "@/components/CsvLink";
import { EvidenceButton } from "@/components/EvidenceButton";
import { fmtLocalTime, localDayRange, siteZoneLabel } from "@/lib/time";
import { fmtNum } from "@/lib/util";
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
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  // Selected row for the detail panel (defaults to the first row).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = displayRows.find((r) => r.id === selectedId) ?? displayRows[0] ?? null;

  // Quick filters only set the filters above; nothing is stored.
  const resetTo = (useCase: string, severity: string) => {
    setSelectedUseCase(useCase);
    setSelectedType("ALL");
    setSelectedCamera("ALL");
    setSelectedSeverity(severity);
    setCursor(undefined);
    setAccumulatedRows([]);
  };
  const quick = [
    { t: "Semua kejadian", uc: "ALL", sev: "ALL" },
    { t: "Kritis", uc: "ALL", sev: "critical" },
    ...(usecasesQuery.data ?? []).map((u) => ({ t: u.label, uc: u.id, sev: "ALL" })),
  ];
  const isQuickOn = (q: { uc: string; sev: string }) =>
    selectedUseCase === q.uc && selectedSeverity === q.sev && selectedType === "ALL" && selectedCamera === "ALL";

  const subtitle = [
    selectedUseCase !== "ALL" ? usecaseMap.get(selectedUseCase) ?? selectedUseCase : "Semua area",
    pickedDate === today ? "hari ini" : pickedDate,
    eventsQuery.isLoading ? "memuat…" : `${fmtNum(displayRows.length)}${eventsQuery.data?.nextCursor ? "+" : ""} kejadian`,
  ].join(" · ");

  const selectCls =
    "h-9 w-auto max-w-full cursor-pointer appearance-none rounded-full border px-3.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-lime/40";
  const pill = (on: boolean) =>
    on ? `${selectCls} border-transparent bg-[#eaf3dc] text-forest` : `${selectCls} border-dashed border-[#cfc9b8] bg-surface text-ink-2`;

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!selected) return;
    const i = displayRows.findIndex((r) => r.id === selected.id);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = displayRows[Math.min(displayRows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next) {
        setSelectedId(next.id);
        listRef.current?.querySelector<HTMLElement>(`[data-row="${next.id}"]`)?.focus();
      }
    } else if (e.key === "Enter" && selected.cameraId) {
      router.push(`/live?cam=${encodeURIComponent(selected.cameraId)}`);
    }
  };

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-56px)] flex-col sm:-mx-6 lg:flex-row 2xl:-mx-8">
      {/* Quick filters */}
      <aside aria-label="Filter cepat" className="flex shrink-0 flex-col gap-1 border-line px-3 py-5 max-lg:border-b lg:w-[230px] lg:border-r">
        <span className="px-2.5 pb-1.5 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">Filter cepat</span>
        <div className="flex flex-wrap gap-1 lg:flex-col">
          {quick.map((q) => {
            const on = isQuickOn(q);
            return (
              <button
                key={q.t}
                type="button"
                aria-pressed={on}
                onClick={() => resetTo(q.uc, q.sev)}
                className={`flex min-h-[38px] cursor-pointer items-center rounded-[9px] px-2.5 text-left text-sm transition-colors ${
                  on ? "bg-[#eaf3dc] font-bold text-forest" : "font-medium text-ink hover:bg-surface-2"
                }`}
              >
                {q.t}
              </button>
            );
          })}
        </div>
        <span className="hidden px-2.5 pt-2.5 text-xs leading-relaxed text-muted lg:block">
          Filter cepat hanya menyetel filter di daftar, tidak menyimpan apa pun di server.
        </span>
      </aside>

      {/* List */}
      <section aria-label="Daftar kejadian" className="flex min-w-0 flex-1 flex-col gap-3.5 px-4 pt-5 pb-8 sm:px-5">
        <PageHeader title="Kejadian" subtitle={subtitle} date={pickedDate}>
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

        <div className="-mt-1.5 flex flex-wrap items-center gap-1.5">
          <select
            value={selectedUseCase}
            onChange={(e) => {
              handleFilterChange(setSelectedUseCase, e.target.value);
              setSelectedType("ALL");
            }}
            aria-label="Filter Use-Case"
            className={pill(selectedUseCase !== "ALL")}
          >
            <option value="ALL">+ Use case</option>
            {(usecasesQuery.data ?? []).map((uc) => (
              <option key={uc.id} value={uc.id}>
                Use case: {uc.label}
              </option>
            ))}
          </select>
          <select
            value={selectedSeverity}
            onChange={(e) => handleFilterChange(setSelectedSeverity, e.target.value)}
            aria-label="Filter Tingkat Keparahan"
            className={pill(selectedSeverity !== "ALL")}
          >
            <option value="ALL">+ Severity</option>
            <option value="info">Severity: Info</option>
            <option value="warning">Severity: Warning</option>
            <option value="critical">Severity: Kritis</option>
          </select>
          <select
            value={selectedCamera}
            onChange={(e) => handleFilterChange(setSelectedCamera, e.target.value)}
            aria-label="Filter Kamera CCTV"
            className={pill(selectedCamera !== "ALL")}
          >
            <option value="ALL">+ Kamera</option>
            {(camerasQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                Kamera: {c.name}
              </option>
            ))}
          </select>
          <select
            value={selectedType}
            onChange={(e) => handleFilterChange(setSelectedType, e.target.value)}
            aria-label="Filter Tipe Kejadian"
            className={pill(selectedType !== "ALL")}
          >
            <option value="ALL">+ Tipe</option>
            {availableTypes.map((t) => (
              <option key={t.type} value={t.type}>
                Tipe: {t.type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(19,36,26,0.04)]">
          {eventsQuery.isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-muted">Memuat log kejadian…</p>
          ) : displayRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              Tidak ada kejadian yang cocok dengan filter pada tanggal {pickedDate}.
            </p>
          ) : (
            <div ref={listRef} role="listbox" aria-label="Kejadian" onKeyDown={onListKey}>
              {displayRows.map((e) => {
                const on = selected?.id === e.id;
                const sev = e.severity.toLowerCase();
                return (
                  <div
                    key={e.id}
                    data-row={e.id}
                    role="option"
                    aria-selected={on}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setSelectedId(e.id)}
                    className={`flex cursor-pointer items-center gap-3 border-t border-line-soft px-3.5 py-[11px] first:border-t-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime ${
                      on ? "bg-[#eaf3dc]" : "hover:bg-surface-2/60"
                    }`}
                  >
                    <span aria-hidden className={`h-8 w-1 shrink-0 rounded-sm ${SEV_BAR[sev] ?? "bg-off"}`} />
                    <span className="w-[62px] shrink-0 font-mono text-xs">{fmtLocalTime(e.time)}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-bold capitalize">{e.type.replace(/_/g, " ")}</span>
                      <span className="truncate text-xs text-muted">
                        {e.cameraName ?? e.cameraId ?? "—"} · {usecaseMap.get(e.useCase) ?? e.useCase}
                      </span>
                    </span>
                    <SeverityBadge severity={e.severity} />
                  </div>
                );
              })}
            </div>
          )}
          {eventsQuery.data?.nextCursor && (
            <div className="flex justify-center border-t border-line p-3">
              <button
                type="button"
                disabled={eventsQuery.isFetching}
                onClick={handleLoadMore}
                className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-[10px] border border-[#cfc9b8] bg-surface px-3.5 text-[13px] font-bold text-forest hover:bg-surface-2 disabled:opacity-50"
              >
                <RefreshCw aria-hidden className={`size-3.5 ${eventsQuery.isFetching ? "animate-spin" : ""}`} />
                {eventsQuery.isFetching ? "Memuat…" : "Muat 100 berikutnya"}
              </button>
            </div>
          )}
        </div>
        {displayRows.length > 0 && (
          <span className="hidden text-xs text-muted lg:block">Tombol ↑ ↓ untuk pindah baris, Enter untuk membuka live.</span>
        )}
      </section>

      {/* Detail */}
      <aside aria-label="Detail kejadian" className="flex shrink-0 flex-col border-line bg-surface max-lg:border-t lg:w-[360px] lg:border-l 2xl:w-[400px]">
        {selected ? (
          <EventDetail key={selected.id} event={selected} usecaseLabel={usecaseMap.get(selected.useCase)} date={pickedDate} />
        ) : (
          <p className="p-5 text-sm text-muted">Pilih kejadian untuk melihat detailnya.</p>
        )}
      </aside>
    </div>
  );
}

const SEV_BAR: Record<string, string> = { info: "bg-[#1d5fa0]", warning: "bg-warn", critical: "bg-crit" };

function EventDetail({ event: e, usecaseLabel, date }: { event: EventRowDto; usecaseLabel?: string; date: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const entries = Object.entries(e.data ?? {});
  const cam = e.cameraName ?? e.cameraId ?? "CCTV";
  return (
    <div className="lg:sticky lg:top-14">
      <div className="relative aspect-video bg-[#1b2822]">
        {e.snapshotUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- a session-protected JPEG from the API
          <img src={e.snapshotUrl} alt={`Snapshot ${cam}`} onError={() => setImgFailed(true)} className="size-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-[#b9c6be]">Tidak ada foto</span>
        )}
      </div>
      <div className="flex flex-col gap-3.5 p-[18px]">
        <div className="flex flex-col items-start gap-1.5">
          <SeverityBadge severity={e.severity} />
          <h2 className="text-lg font-extrabold capitalize">{e.type.replace(/_/g, " ")}</h2>
          <span className="text-[13px] text-muted">
            {cam} · {date}, {fmtLocalTime(e.time)} {siteZoneLabel()}
          </span>
        </div>
        {entries.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {entries.map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col rounded-[10px] bg-bg p-2.5">
                <span className="truncate text-[11px] font-bold text-muted">{k}</span>
                <span className="truncate text-base font-extrabold">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          {e.cameraId && (
            <Link
              href={`/live?cam=${encodeURIComponent(e.cameraId)}`}
              className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-forest text-[13px] font-bold text-white hover:bg-accent-hover"
            >
              <Video aria-hidden className="size-4" /> Buka live kamera
            </Link>
          )}
          <EvidenceButton snapshotUrl={e.snapshotUrl} clipUrl={e.clipUrl} title={`${cam} · ${date} ${fmtLocalTime(e.time)} ${siteZoneLabel()}`} />
        </div>
        <div className="flex flex-col gap-1.5 text-[13px]">
          <span className="text-xs font-bold text-muted">Data teknis</span>
          <Row k="Use case" v={usecaseLabel ?? e.useCase} />
          <Row k="Tipe" v={e.type} mono />
          <Row k="Versi config" v={e.configVersion != null ? `v${e.configVersion}` : "—"} mono />
          <Row k="ID kejadian" v={e.id} mono />
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={`truncate text-right ${mono ? "font-mono text-xs" : "font-semibold"}`}>{v}</span>
    </div>
  );
}
