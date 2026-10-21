"use client";

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Save } from "lucide-react";
import { useSiteSettingsGet, useSiteSettingsUpdate } from "@/api/generated/site-settings/site-settings";
import type { SiteSettingsDto, UpdateSiteSettingsDto } from "@/api/generated/zooVisionAPI.schemas";
import { ApiError } from "@/api/http";
import { useMe } from "@/auth/AuthProvider";
import { RequireRole } from "@/auth/RequireRole";
import { roleAtLeast } from "@/auth/roles";
import { Badge, Card, Note, PageHeader } from "@/components/ui";
import { setSiteTimeZone } from "@/lib/time";

const INPUT =
  "mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none";
const LABEL = "block text-xs font-extrabold uppercase tracking-wider text-ink-2";

type DayKey = "recordingRetentionDays" | "snapshotRetentionDays" | "auditSnapshotRetentionDays" | "evidenceRetentionDays";

const RETENTION: { key: DayKey; label: string; hint?: string }[] = [
  { key: "recordingRetentionDays", label: "Retensi rekaman (hari)", hint: "Berlaku untuk kamera tanpa pengaturan sendiri" },
  { key: "snapshotRetentionDays", label: "Retensi snapshot (hari)" },
  { key: "auditSnapshotRetentionDays", label: "Retensi snapshot kamera audit (hari)" },
  { key: "evidenceRetentionDays", label: "Retensi bukti (hari)", hint: "Berlaku untuk kamera tanpa pengaturan bukti sendiri" },
];

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] font-bold text-crit-ink">{error}</p>}
      {hint && <Note>{hint}</Note>}
    </div>
  );
}

function SiteSettingsForm({ settings, canEdit }: { settings: SiteSettingsDto; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [siteName, setSiteName] = useState(settings.siteName);
  const [timeZone, setTimeZone] = useState(settings.timeZone);
  const [days, setDays] = useState<Record<DayKey, string>>({
    recordingRetentionDays: String(settings.recordingRetentionDays),
    snapshotRetentionDays: String(settings.snapshotRetentionDays),
    auditSnapshotRetentionDays: String(settings.auditSnapshotRetentionDays),
    evidenceRetentionDays: String(settings.evidenceRetentionDays),
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = useSiteSettingsUpdate({
    mutation: {
      onSuccess: (result) => {
        if (result.timeZone !== settings.timeZone) setSiteTimeZone(result.timeZone);
        void queryClient.invalidateQueries();
        setFieldErrors({});
        setGeneralError(null);
        setSaved(true);
      },
      onError: (err) => {
        setSaved(false);
        if (err instanceof ApiError) {
          const errs: Record<string, string> = {};
          for (const item of err.errors ?? []) errs[item.path.replace(/^\//, "")] = item.message;
          setFieldErrors(errs);
          setGeneralError(err.message || "Gagal menyimpan pengaturan situs.");
        } else {
          setGeneralError("Terjadi kesalahan sistem.");
        }
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);
    setSaved(false);

    const data: UpdateSiteSettingsDto = {};
    if (siteName.trim() !== settings.siteName) data.siteName = siteName.trim();
    if (timeZone.trim() !== settings.timeZone) data.timeZone = timeZone.trim();
    for (const { key } of RETENTION) {
      if (Number(days[key]) !== settings[key]) data[key] = Number(days[key]);
    }
    if (Object.keys(data).length === 0) {
      setSaved(true);
      return;
    }
    update.mutate({ data });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {generalError && (
        <div role="alert" className="rounded-2xl border border-crit/25 bg-crit-bg p-4 text-xs font-bold text-crit-ink">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-crit" />
            <span>{generalError}</span>
          </div>
        </div>
      )}

      <Card title="Identitas dan zona waktu" subtitle="Nama situs dan zona waktu untuk semua jam dan laporan">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="site-name" label="Nama situs" error={fieldErrors["siteName"]}>
            <input
              id="site-name"
              type="text"
              maxLength={100}
              disabled={!canEdit}
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field id="site-zone" label="Zona waktu" error={fieldErrors["timeZone"]} hint="Nama zona IANA, misalnya Asia/Jakarta atau Asia/Makassar">
            <input
              id="site-zone"
              type="text"
              list="site-zones"
              disabled={!canEdit}
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className={INPUT}
            />
            <datalist id="site-zones">
              {Intl.supportedValuesOf("timeZone").map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </Field>
        </div>
      </Card>

      <Card title="Retensi data" subtitle="Berapa lama data disimpan sebelum dibersihkan">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {RETENTION.map(({ key, label, hint }) => (
            <Field key={key} id={`site-${key}`} label={label} error={fieldErrors[key]} hint={hint}>
              <input
                id={`site-${key}`}
                type="number"
                min={1}
                max={3650}
                disabled={!canEdit}
                value={days[key]}
                onChange={(e) => setDays({ ...days, [key]: e.target.value })}
                className={INPUT}
              />
            </Field>
          ))}
        </div>
      </Card>

      {canEdit ? (
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && <Badge tone="good">Tersimpan</Badge>}
          <button
            type="submit"
            disabled={update.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-6 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-forest-dark hover:shadow-lg disabled:opacity-50"
          >
            <Save className="size-4" />
            {update.isPending ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      ) : (
        <Note>Hanya Superadmin yang dapat mengubah pengaturan situs.</Note>
      )}
    </form>
  );
}

export function SiteSettingsPage() {
  const { me } = useMe();
  const canEdit = roleAtLeast(me?.role ?? "USER", "SUPERADMIN");
  const settingsQuery = useSiteSettingsGet();
  const settings = settingsQuery.data;

  return (
    <RequireRole min="MANAGER">
      <PageHeader title="Pengaturan situs" subtitle="Zona waktu dan masa simpan data untuk seluruh situs." />
      {!settings ? (
        <Card>
          <div className="py-12 text-center text-xs font-bold text-muted">
            {settingsQuery.isError ? "Gagal memuat pengaturan situs." : "Memuat pengaturan situs..."}
          </div>
        </Card>
      ) : (
        <SiteSettingsForm settings={settings} canEdit={canEdit} />
      )}
    </RequireRole>
  );
}
