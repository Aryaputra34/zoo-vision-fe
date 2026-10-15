"use client";

import { useState, useMemo } from "react";
import { Search, RefreshCw } from "lucide-react";
import { useSystemLogLogins } from "@/api/generated/system-log/system-log";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader, Card, Table } from "@/components/ui";
import { CsvLink } from "@/components/CsvLink";
import { fmtLocalTime, localDayRange } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import type { LoginResult, LoginRowDto } from "@/api/generated/zooVisionAPI.schemas";

const RESULT_LABELS: Record<LoginResult, { label: string; badgeCls: string }> = {
  SUCCESS: { label: "Berhasil", badgeCls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  WRONG_PASSWORD: { label: "Kata Sandi Salah", badgeCls: "bg-red-100 text-red-800 border-red-300" },
  DISABLED: { label: "Akun Dinonaktifkan", badgeCls: "bg-zinc-100 text-zinc-600 border-zinc-300" },
  LOCKED: { label: "Akun Terkunci (5x Salah)", badgeCls: "bg-red-100 text-red-800 border-red-300" },
  RATE_LIMITED: { label: "Dibatasi (Rate Limit)", badgeCls: "bg-amber-100 text-amber-800 border-amber-300" },
  LOGOUT: { label: "Keluar (Logout)", badgeCls: "bg-zinc-100 text-zinc-700 border-zinc-300" },
};

export function LoginsPage({ date: picked }: { date?: string } = {}) {
  const today = useToday();
  const pickedDate = picked ?? today;
  const day = localDayRange(pickedDate);

  const [usernameSearch, setUsernameSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<string>("ALL");

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulatedRows, setAccumulatedRows] = useState<LoginRowDto[]>([]);

  const queryParams = useMemo(() => {
    return {
      from: day.from,
      to: day.to,
      username: usernameSearch.trim() || undefined,
      result: resultFilter !== "ALL" ? (resultFilter as LoginResult) : undefined,
      cursor,
      limit: 100,
    };
  }, [day.from, day.to, usernameSearch, resultFilter, cursor]);

  const loginsQuery = useSystemLogLogins(queryParams);

  const handleLoadMore = () => {
    if (loginsQuery.data?.nextCursor) {
      if (loginsQuery.data?.rows) {
        const newRows = loginsQuery.data.rows;
        setAccumulatedRows((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const toAdd = newRows.filter((r) => !existingIds.has(r.id));
          return [...prev, ...toAdd];
        });
      }
      setCursor(loginsQuery.data.nextCursor);
    }
  };

  const rows = useMemo(() => {
    const currentRows = loginsQuery.data?.rows ?? [];
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
  }, [loginsQuery.data?.rows, cursor, accumulatedRows]);

  const handleFilterChange = (setter: (v: string) => void, val: string) => {
    setter(val);
    setCursor(undefined);
    setAccumulatedRows([]);
  };

  return (
    <RequireRole min="MANAGER">
      <PageHeader
        tag="Log Sistem & Keamanan"
        title="Riwayat Autentikasi & Sesi Login (Login History)"
        subtitle="Log percobaan masuk, verifikasi kata sandi, insiden penguncian akun, dan sesi aktif"
        date={pickedDate}
      >
        <CsvLink
          path="/api/v1/system-log/logins.csv"
          params={{
            from: day.from,
            to: day.to,
            username: usernameSearch.trim() || undefined,
            result: resultFilter !== "ALL" ? resultFilter : undefined,
          }}
        />
      </PageHeader>

      {/* Filter toolbar */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={usernameSearch}
            onChange={(e) => handleFilterChange(setUsernameSearch, e.target.value)}
            placeholder="Cari berdasarkan username..."
            className="w-full rounded-2xl border border-line bg-surface py-2.5 pl-10 pr-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none"
          />
        </div>

        <div className="relative">
          <select
            value={resultFilter}
            onChange={(e) => handleFilterChange(setResultFilter, e.target.value)}
            className="w-full appearance-none rounded-2xl border border-line bg-surface py-2.5 px-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none"
          >
            <option value="ALL">Semua Hasil Autentikasi</option>
            <option value="SUCCESS">Berhasil (SUCCESS)</option>
            <option value="WRONG_PASSWORD">Kata Sandi Salah (WRONG_PASSWORD)</option>
            <option value="LOCKED">Akun Terkunci (LOCKED)</option>
            <option value="DISABLED">Akun Dinonaktifkan (DISABLED)</option>
            <option value="RATE_LIMITED">Dibatasi (RATE_LIMITED)</option>
            <option value="LOGOUT">Keluar (LOGOUT)</option>
          </select>
        </div>
      </div>

      <Card
        title={`Log Aktivitas Sesi (${rows.length} Baris)`}
        subtitle="Mencatat seluruh percobaan akses masuk dan alamat IP pengakses"
      >
        <Table
          head={[
            "Waktu",
            "Username yang Diketik",
            "Hasil Autentikasi",
            "Alamat IP Klien",
            "Perangkat / User-Agent",
          ]}
          rows={rows.map((r) => {
            const meta = RESULT_LABELS[r.result] ?? {
              label: r.result,
              badgeCls: "bg-zinc-100 text-zinc-600 border-zinc-200",
            };

            return [
              fmtLocalTime(r.time),

              <div key="user" className="flex flex-col">
                <span className="font-extrabold text-forest">{r.username}</span>
                {r.userId && (
                  <span className="text-[10px] text-muted">ID: {r.userId}</span>
                )}
              </div>,

              <span
                key="res"
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-black w-fit ${meta.badgeCls}`}
              >
                {meta.label}
              </span>,

              <span key="ip" className="font-mono text-xs text-ink font-semibold">
                {r.ip ?? "—"}
              </span>,

              <span
                key="ua"
                className="text-[11px] text-muted line-clamp-1 max-w-sm"
                title={r.userAgent ?? "—"}
              >
                {r.userAgent ?? "—"}
              </span>,
            ];
          })}
          empty={
            loginsQuery.isLoading
              ? "Memuat riwayat login..."
              : rows.length === 0
              ? `Tidak ada log login yang cocok pada tanggal ${pickedDate}.`
              : undefined
          }
        />

        {loginsQuery.data?.nextCursor && (
          <div className="mt-6 flex justify-center border-t border-line/60 pt-4">
            <button
              type="button"
              disabled={loginsQuery.isFetching}
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-2.5 text-xs font-black text-forest shadow-sm transition hover:border-lime hover:bg-lime/10 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${loginsQuery.isFetching ? "animate-spin" : ""}`} />
              Muat Halaman Berikutnya
            </button>
          </div>
        )}
      </Card>
    </RequireRole>
  );
}
