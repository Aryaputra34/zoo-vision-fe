"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileText } from "lucide-react";
import { useCamerasList } from "@/api/generated/cameras/cameras";
import { getExportJobsListQueryKey, useExportJobsCreate, useExportJobsList } from "@/api/generated/export-jobs/export-jobs";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import {
  CreateExportJobDtoPeriod,
  ExportJobDtoStatus,
  type CreateExportJobDto,
  type ExportJobDto,
} from "@/api/generated/zooVisionAPI.schemas";
import { ApiError } from "@/api/http";
import { AnalyticsTabs } from "@/components/client";
import { CsvLink } from "@/components/CsvLink";
import { Badge, Card, Note, PageHeader, Table, type Tone } from "@/components/ui";
import { addDays, fmtLocalTime, localDate, localDayRange, siteZoneLabel, todayLocal } from "@/lib/time";

const INPUT =
  "mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none";
const LABEL = "block text-xs font-extrabold uppercase tracking-wider text-ink-2";

const PERIODS: { value: CreateExportJobDto["period"]; label: string }[] = [
  { value: CreateExportJobDtoPeriod.day, label: "Harian" },
  { value: CreateExportJobDtoPeriod.week, label: "Mingguan" },
  { value: CreateExportJobDtoPeriod.month, label: "Bulanan" },
];

const STATUS: Record<ExportJobDto["status"], { label: string; tone: Tone }> = {
  [ExportJobDtoStatus.QUEUED]: { label: "Menunggu", tone: "info" },
  [ExportJobDtoStatus.DONE]: { label: "Selesai", tone: "good" },
  [ExportJobDtoStatus.FAILED]: { label: "Gagal", tone: "crit" },
  [ExportJobDtoStatus.EXPIRED]: { label: "Kedaluwarsa", tone: "off" },
};

const fmtSize = (bytes: number | null) => (bytes === null ? "—" : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function PdfForm() {
  const queryClient = useQueryClient();
  const camerasQuery = useCamerasList();
  const usecasesQuery = useUsecasesList();

  const [period, setPeriod] = useState<CreateExportJobDto["period"]>(CreateExportJobDtoPeriod.week);
  // a week runs 7 days from `date`, so the default week is the last 7 days, like the CSV range below
  const [date, setDate] = useState(() => addDays(todayLocal(), -6));
  const [scope, setScope] = useState<"cameras" | "usecase">("cameras");
  const [cameraIds, setCameraIds] = useState<string[]>([]);
  const [useCase, setUseCase] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useExportJobsCreate({
    mutation: {
      onSuccess: () => {
        setError(null);
        void queryClient.invalidateQueries({ queryKey: getExportJobsListQueryKey() });
      },
      onError: (err) => {
        if (err instanceof ApiError && err.statusCode === 503) setError("Layanan PDF tidak tersedia");
        else if (err instanceof ApiError) setError(err.message || "Gagal membuat PDF.");
        else setError("Terjadi kesalahan sistem.");
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const data: CreateExportJobDto = { period, date };
    if (scope === "cameras" && cameraIds.length > 0) data.cameraIds = cameraIds;
    if (scope === "usecase" && useCase) data.useCase = useCase;
    create.mutate({ data });
  };

  const toggleCamera = (id: string) =>
    setCameraIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Card title="Laporan PDF" subtitle="Ringkasan tabel dan grafik; dibuat di latar belakang">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-2xl border border-crit/25 bg-crit-bg p-4 text-xs font-bold text-crit-ink">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-crit" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="pdf-period" className={LABEL}>
              Periode
            </label>
            <select
              id="pdf-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as CreateExportJobDto["period"])}
              className={INPUT}
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pdf-date" className={LABEL}>
              Tanggal
            </label>
            <input
              id="pdf-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="pdf-scope" className={LABEL}>
              Cakupan
            </label>
            <select
              id="pdf-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as "cameras" | "usecase")}
              className={INPUT}
            >
              <option value="cameras">Kamera</option>
              <option value="usecase">Use case</option>
            </select>
          </div>
        </div>

        {scope === "cameras" ? (
          <fieldset>
            <legend className={LABEL}>Kamera</legend>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(camerasQuery.data ?? []).map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink">
                  <input
                    type="checkbox"
                    checked={cameraIds.includes(c.id)}
                    onChange={() => toggleCamera(c.id)}
                    className="size-4 rounded border-line text-forest focus:ring-lime"
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <Note>Tanpa pilihan, semua kamera disertakan.</Note>
          </fieldset>
        ) : (
          <div className="sm:max-w-xs">
            <label htmlFor="pdf-usecase" className={LABEL}>
              Use case
            </label>
            <select id="pdf-usecase" value={useCase} onChange={(e) => setUseCase(e.target.value)} className={INPUT}>
              <option value="">Semua use case</option>
              {(usecasesQuery.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-6 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-forest-dark hover:shadow-lg disabled:opacity-50"
          >
            <FileText className="size-4" />
            {create.isPending ? "Membuat..." : "Buat PDF"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function JobsList() {
  // Refresh every 3 s while any job is still queued, like the models page.
  const jobsQuery = useExportJobsList({
    query: {
      refetchInterval: (q) => (q.state.data?.some((j) => j.status === ExportJobDtoStatus.QUEUED) ? 3000 : false),
    },
  });
  const periodLabel = (p: string) => PERIODS.find((x) => x.value === p)?.label ?? p;

  const rows = (jobsQuery.data ?? []).map((j) => {
    const s = STATUS[j.status];
    return [
      `${localDate(j.createdAt)} ${fmtLocalTime(j.createdAt)} ${siteZoneLabel()}`,
      `${periodLabel(j.params.period)} · ${j.params.date}`,
      <Badge key="status" tone={s.tone}>
        {s.label}
      </Badge>,
      fmtSize(j.sizeBytes),
      j.status === ExportJobDtoStatus.DONE && j.fileUrl ? (
        <a key="file" href={j.fileUrl} className="text-xs font-extrabold text-forest underline hover:text-forest-dark">
          Unduh PDF
        </a>
      ) : j.status === ExportJobDtoStatus.FAILED ? (
        <span key="error" className="text-xs font-bold text-crit-ink">
          {j.error ?? "Gagal"}
        </span>
      ) : (
        "—"
      ),
    ];
  });

  return (
    <Card title="Laporan saya" subtitle="Berkas dihapus 7 hari setelah selesai">
      {jobsQuery.isError ? (
        <div className="py-8 text-center text-xs font-bold text-crit-ink">Gagal memuat daftar laporan.</div>
      ) : (
        <Table
          head={["Dibuat", "Periode", "Status", "Ukuran", "Berkas"]}
          rows={rows}
          align={["left", "left", "left", "right", "left"]}
          empty="Belum ada laporan PDF."
        />
      )}
    </Card>
  );
}

function CsvSection() {
  const usecasesQuery = useUsecasesList();
  const [to, setTo] = useState(() => todayLocal());
  const [from, setFrom] = useState(() => addDays(todayLocal(), -6));
  const [useCase, setUseCase] = useState("");

  const valid = from !== "" && to !== "" && from <= to;
  // Both dates are inclusive: the range ends at the midnight after `to`.
  const range = valid ? { from: localDayRange(from).from, to: localDayRange(to).to } : null;
  const params = { from: range?.from, to: range?.to, useCase: useCase || undefined };

  const files = [
    { path: "/api/v1/exports/events.csv", name: "Kejadian", sub: "Satu baris per kejadian", extra: {} },
    { path: "/api/v1/exports/intervals.csv", name: "Interval", sub: "Rentang durasi per kamera", extra: {} },
    { path: "/api/v1/exports/metrics.csv", name: "Metrik", sub: "Deret waktu per menit", extra: {} },
    { path: "/api/v1/exports/summary.csv", name: "Ringkasan harian", sub: "Satu baris per kamera per hari", extra: { bucket: "day" } },
  ];

  return (
    <Card title="Unduhan CSV" subtitle="Tanggal awal dan akhir sama-sama disertakan">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="csv-from" className={LABEL}>
            Dari
          </label>
          <input id="csv-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="csv-to" className={LABEL}>
            Sampai
          </label>
          <input id="csv-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label htmlFor="csv-usecase" className={LABEL}>
            Use case (opsional)
          </label>
          <select id="csv-usecase" value={useCase} onChange={(e) => setUseCase(e.target.value)} className={INPUT}>
            <option value="">Semua use case</option>
            {(usecasesQuery.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {range ? (
        // CsvLink is styled for the dark page band, so the links sit on a forest panel.
        <ul className="mt-4 divide-y divide-white/10 rounded-xl bg-forest px-4">
          {files.map((f) => (
            <li key={f.path} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <div className="text-sm font-extrabold text-white">{f.name}</div>
                <div className="text-xs text-white/70">{f.sub}</div>
              </div>
              <CsvLink path={f.path} params={{ ...params, ...f.extra }} />
            </li>
          ))}
        </ul>
      ) : (
        <Note>Tanggal awal harus sebelum atau sama dengan tanggal akhir.</Note>
      )}
    </Card>
  );
}

export function ExportsPage() {
  return (
    <>
      <PageHeader title="Ekspor" subtitle="Laporan PDF dan unduhan CSV untuk rentang tanggal tertentu." />
      <AnalyticsTabs />
      <div className="space-y-6">
        <PdfForm />
        <JobsList />
        <CsvSection />
      </div>
    </>
  );
}
