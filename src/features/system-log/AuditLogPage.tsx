"use client";

import { SystemLogTabs } from "@/components/client";
import { useState, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Eye,
} from "lucide-react";
import { useSystemLogAudit } from "@/api/generated/system-log/system-log";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader, Card, Table } from "@/components/ui";
import { CsvLink } from "@/components/CsvLink";
import { fmtLocalTime, localDayRange } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import type { AuditRowDto } from "@/api/generated/zooVisionAPI.schemas";

export function AuditLogPage({ date: picked }: { date?: string } = {}) {
  const today = useToday();
  const pickedDate = picked ?? today;
  const day = localDayRange(pickedDate);

  // Filters
  const [actorSearch, setActorSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [auditCameraOnly, setAuditCameraOnly] = useState(false);

  // Pagination
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulatedRows, setAccumulatedRows] = useState<AuditRowDto[]>([]);

  // Expanded row for diff view
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    return {
      from: day.from,
      to: day.to,
      actor: actorSearch.trim() || undefined,
      entity: entityFilter !== "ALL" ? entityFilter : undefined,
      auditCamera: auditCameraOnly ? ("true" as const) : undefined,
      cursor,
      limit: 100,
    };
  }, [day.from, day.to, actorSearch, entityFilter, auditCameraOnly, cursor]);

  const auditQuery = useSystemLogAudit(queryParams);

  const handleLoadMore = () => {
    if (auditQuery.data?.nextCursor) {
      if (auditQuery.data?.rows) {
        const newRows = auditQuery.data.rows;
        setAccumulatedRows((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const toAdd = newRows.filter((r) => !existingIds.has(r.id));
          return [...prev, ...toAdd];
        });
      }
      setCursor(auditQuery.data.nextCursor);
    }
  };

  const rows = useMemo(() => {
    const currentRows = auditQuery.data?.rows ?? [];
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
  }, [auditQuery.data?.rows, cursor, accumulatedRows]);

  const handleFilterChange = <T,>(setter: (v: T) => void, val: T) => {
    setter(val);
    setCursor(undefined);
    setAccumulatedRows([]);
  };

  return (
    <RequireRole min="MANAGER">
      <PageHeader
        title="Log sistem"
        subtitle="Jejak perubahan konfigurasi kamera, model, akun, dan ekspor data."
        date={pickedDate}
      >
        <CsvLink
          path="/api/v1/system-log/audit.csv"
          params={{
            from: day.from,
            to: day.to,
            actor: actorSearch.trim() || undefined,
            entity: entityFilter !== "ALL" ? entityFilter : undefined,
            auditCamera: auditCameraOnly ? "true" : undefined,
          }}
        />
      </PageHeader>
      <SystemLogTabs />

      {/* Filter toolbar */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={actorSearch}
            onChange={(e) => handleFilterChange(setActorSearch, e.target.value)}
            placeholder="Cari nama pengguna / aktor..."
            className="w-full rounded-2xl border border-line bg-surface py-2.5 pl-10 pr-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none"
          />
        </div>

        <div className="relative">
          <select
            value={entityFilter}
            onChange={(e) => handleFilterChange(setEntityFilter, e.target.value)}
            className="w-full appearance-none rounded-2xl border border-line bg-surface py-2.5 px-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none"
          >
            <option value="ALL">Semua Entitas Sistem</option>
            <option value="camera">Kamera (camera)</option>
            <option value="camera_config">Konfigurasi Kamera (camera_config)</option>
            <option value="model">Model AI (model)</option>
            <option value="user">Pengguna (user)</option>
            <option value="api_token">Token API (api_token)</option>
            <option value="export">Ekspor CSV (export)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 px-2">
          <input
            type="checkbox"
            id="audit-only-check"
            checked={auditCameraOnly}
            onChange={(e) => handleFilterChange(setAuditCameraOnly, e.target.checked)}
            className="size-4 rounded border-line text-forest focus:ring-lime"
          />
          <label htmlFor="audit-only-check" className="text-xs font-bold text-ink cursor-pointer">
            Hanya Kamera Audit Sensitif
          </label>
        </div>
      </div>

      <Card
        title={`Entri Log Audit (${rows.length} Baris)`}
        subtitle="Diurutkan kronologis dari perubahan terbaru. Baris kamera audit ditandai khusus."
      >
        <Table
          head={[
            "Waktu",
            "Aktor / Pengguna",
            "Aksi & Entitas",
            "Target / ID",
            "Alamat IP",
            "Perubahan Data",
          ]}
          rows={rows.map((r) => {
            const isExpanded = expandedRowId === r.id;
            const hasDiff = r.before || r.after;

            return [
              <div key="time" className="flex flex-col">
                <span>{fmtLocalTime(r.time)}</span>
                {r.auditCamera && (
                  <span className="mt-1 w-fit rounded-full bg-warn-bg px-2 py-0.5 text-[9px] font-extrabold text-gold-ink border border-warn/25">
                    Kamera Audit
                  </span>
                )}
              </div>,

              <div key="actor" className="flex flex-col">
                <span className="font-extrabold text-forest">{r.actorName}</span>
                <span className="text-[10px] text-muted">Tipe: {r.actorType}</span>
              </div>,

              <div key="action" className="flex flex-col">
                <span className="font-mono text-xs font-bold text-ink">{r.action}</span>
                <span className="text-[10px] text-muted">{r.entity}</span>
              </div>,

              <span key="target" className="text-xs font-semibold text-ink">
                {r.entityId ?? "—"}
              </span>,

              <span key="ip" className="text-xs font-mono text-muted">
                {r.ip ?? "—"}
              </span>,

              <div key="diff">
                {hasDiff ? (
                  <button
                    type="button"
                    onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1 text-xs font-bold text-forest hover:bg-lime/10"
                  >
                    <Eye className="size-3" />
                    <span>{isExpanded ? "Tutup Diff" : "Lihat Diff"}</span>
                  </button>
                ) : (
                  <span className="text-muted text-xs">—</span>
                )}
              </div>,
            ];
          })}
          empty={
            auditQuery.isLoading
              ? "Memuat log audit..."
              : rows.length === 0
              ? `Tidak ada catatan audit yang cocok pada tanggal ${pickedDate}.`
              : undefined
          }
        />

        {/* Expanded Diff Preview Modal / Drawer */}
        {expandedRowId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-2xl">
              {(() => {
                const item = rows.find((r) => r.id === expandedRowId);
                if (!item) return null;

                return (
                  <div>
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div>
                        <h3 className="text-base font-extrabold text-ink">Perbandingan Nilai (Diff)</h3>
                        <p className="text-xs text-muted">
                          {item.action} pada {item.entity} ({item.entityId ?? "—"}) oleh {item.actorName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedRowId(null)}
                        className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs font-mono">
                      <div className="rounded-2xl border border-crit/25 bg-crit-bg p-4">
                        <div className="text-[11px] font-extrabold text-crit-ink uppercase mb-2">Sebelumnya (Before)</div>
                        <pre className="text-ink-2 whitespace-pre-wrap break-all text-[11px]">
                          {JSON.stringify(item.before, null, 2) || "Tidak ada data sebelumnya"}
                        </pre>
                      </div>

                      <div className="rounded-2xl border border-good/25 bg-good-bg p-4">
                        <div className="text-[11px] font-extrabold text-good uppercase mb-2">Sesudahnya (After)</div>
                        <pre className="text-ink-2 whitespace-pre-wrap break-all text-[11px]">
                          {JSON.stringify(item.after, null, 2) || "Tidak ada data perubahan"}
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {auditQuery.data?.nextCursor && (
          <div className="mt-6 flex justify-center border-t border-line/60 pt-4">
            <button
              type="button"
              disabled={auditQuery.isFetching}
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-2.5 text-xs font-extrabold text-forest shadow-sm transition hover:border-lime hover:bg-lime/10 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${auditQuery.isFetching ? "animate-spin" : ""}`} />
              Muat Halaman Berikutnya
            </button>
          </div>
        )}
      </Card>
    </RequireRole>
  );
}
