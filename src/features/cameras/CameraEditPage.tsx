"use client";

import { useState } from "react";
import Link from "next/link";
import { CameraTabs } from "@/components/client";
import { ArrowLeft, Save, Sliders, AlertCircle, Check } from "lucide-react";
import { useCamerasGet, useCamerasUpdate } from "@/api/generated/cameras/cameras";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import { useMe } from "@/auth/AuthProvider";
import { roleAtLeast } from "@/auth/roles";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader, Card } from "@/components/ui";
import { ApiError } from "@/api/http";
import type { CameraViewDto, UpdateCameraDto, SourceType, StreamChoice, UseCaseDto } from "@/api/generated/zooVisionAPI.schemas";

interface CameraEditFormProps {
  id: string;
  camera: CameraViewDto;
  isSuperadmin: boolean;
  usecase?: UseCaseDto;
}

function CameraEditForm({ id, camera, isSuperadmin, usecase }: CameraEditFormProps) {
  const [name, setName] = useState(camera.name ?? "");
  const [area, setArea] = useState(camera.area ?? "");
  const [enabled, setEnabled] = useState(camera.enabled ?? true);

  // Superadmin-only fields
  const [sourceType, setSourceType] = useState<SourceType>(camera.sourceType ?? "RTSP");
  const [mainStreamUrl, setMainStreamUrl] = useState(camera.mainStreamUrl ?? "");
  const [subStreamUrl, setSubStreamUrl] = useState(camera.subStreamUrl ?? "");
  const [engineGroup, setEngineGroup] = useState(camera.engineGroup ?? "default");
  const [targetFps, setTargetFps] = useState(camera.targetFps ?? 15);
  const [inferenceStream, setInferenceStream] = useState<StreamChoice>(camera.inferenceStream ?? "MAIN");
  const [auditCamera, setAuditCamera] = useState(camera.auditCamera ?? false);

  // Recording
  const [recordingEnabled, setRecordingEnabled] = useState(
    camera.recording?.stream !== undefined || false
  );
  // Empty = follow the site setting (sent as null).
  const [retentionDays, setRetentionDays] = useState(
    camera.recording?.retentionDays != null ? String(camera.recording.retentionDays) : ""
  );
  const [evidenceRetentionDays, setEvidenceRetentionDays] = useState(
    camera.recording?.evidenceRetentionDays != null ? String(camera.recording.evidenceRetentionDays) : ""
  );
  const [clipBeforeSec, setClipBeforeSec] = useState(camera.recording?.clipBeforeSec ?? 5);
  const [clipAfterSec, setClipAfterSec] = useState(camera.recording?.clipAfterSec ?? 15);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateMutation = useCamerasUpdate({
    mutation: {
      onSuccess: () => {
        setSaveSuccess(true);
        setFieldErrors({});
        setGeneralError(null);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
      onError: (err) => {
        setSaveSuccess(false);
        if (err instanceof ApiError) {
          if (err.code === "ROLE_REQUIRED") {
            setGeneralError("Izin tidak mencukupi untuk mengubah parameter teknis kamera ini.");
            if (err.errors) {
              const errs: Record<string, string> = {};
              for (const e of err.errors) {
                errs[e.path.replace(/^\//, "")] = e.message;
              }
              setFieldErrors(errs);
            }
          } else if (err.errors && err.errors.length > 0) {
            const errs: Record<string, string> = {};
            for (const item of err.errors) {
              const key = item.path.replace(/^\//, "").replace(/\//g, ".");
              errs[key] = item.message;
            }
            setFieldErrors(errs);
            setGeneralError(err.message || "Terdapat kesalahan validasi.");
          } else {
            setGeneralError(err.message || "Gagal memperbarui kamera.");
          }
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

    const payload: UpdateCameraDto = {
      name: name.trim(),
      area: area.trim() ? area.trim() : null,
      enabled,
    };

    if (isSuperadmin) {
      payload.sourceType = sourceType;
      if (mainStreamUrl) payload.mainStreamUrl = mainStreamUrl.trim();
      payload.subStreamUrl = subStreamUrl.trim() ? subStreamUrl.trim() : null;
      payload.engineGroup = engineGroup.trim() ? engineGroup.trim() : "default";
      payload.targetFps = Number(targetFps);
      payload.inferenceStream = inferenceStream;
      payload.auditCamera = auditCamera;
      payload.recording = {
        enabled: recordingEnabled,
        stream: inferenceStream,
        retentionDays: retentionDays.trim() === "" ? null : Number(retentionDays),
        evidenceRetentionDays: evidenceRetentionDays.trim() === "" ? null : Number(evidenceRetentionDays),
        clipBeforeSec: Number(clipBeforeSec),
        clipAfterSec: Number(clipAfterSec),
      };
    }

    updateMutation.mutate({ id, data: payload });
  };

  return (
    <>
      {saveSuccess && (
        <div className="mb-6 inline-flex w-full items-center gap-2 rounded-2xl border border-good/25 bg-good-bg p-4 text-xs font-bold text-good">
          <Check className="size-4 text-good" />
          <span>Pengaturan kamera berhasil diperbarui.</span>
        </div>
      )}

      {generalError && (
        <div role="alert" className="mb-6 rounded-2xl border border-crit/25 bg-crit-bg p-4 text-xs font-bold text-crit-ink">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-crit" />
            <span>{generalError}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Identitas Kamera" subtitle="Nama, area operasional, dan status aktif">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                ID Kamera (Permanen)
              </label>
              <div className="mt-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs font-mono font-bold text-muted">
                {camera.id}
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Use-Case Analitik AI
              </label>
              <div className="mt-1.5 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs font-bold text-muted">
                {usecase?.label ?? camera.useCase} ({camera.useCase})
              </div>
            </div>

            <div>
              <label htmlFor="edit-name" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Nama Kamera <span className="text-crit">*</span>
              </label>
              <input
                id="edit-name"
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              />
              {fieldErrors["name"] && (
                <p className="mt-1 text-[11px] font-bold text-crit">{fieldErrors["name"]}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit-area" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Area Operasional
              </label>
              <input
                id="edit-area"
                type="text"
                maxLength={100}
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Misal: Gerbang Utama"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              />
              {fieldErrors["area"] && (
                <p className="mt-1 text-[11px] font-bold text-crit">{fieldErrors["area"]}</p>
              )}
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 pt-2">
              <input
                id="edit-enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="size-4 rounded border-line text-forest focus:ring-lime"
              />
              <label htmlFor="edit-enabled" className="text-xs font-bold text-ink cursor-pointer">
                Kamera Aktif (Proses pipeline analitik AI berjalan)
              </label>
            </div>
          </div>
        </Card>

        {/* Superadmin Section */}
        <Card
          title="Konfigurasi Stream & Engine"
          subtitle={
            isSuperadmin
              ? "Parameter teknis RTSP/WebRTC dan alokasi engine AI"
              : "Hanya Superadmin yang memiliki izin untuk mengubah konfigurasi stream"
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Tipe Sumber
              </label>
              <select
                disabled={!isSuperadmin}
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none"
              >
                <option value="RTSP">RTSP (Real-Time Streaming Protocol)</option>
                <option value="WEBRTC">WebRTC (WHEP / Low-Latency)</option>
                <option value="STATIC_IMAGE">Static Image (Mock / Testing)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Engine Group
              </label>
              <input
                disabled={!isSuperadmin}
                type="text"
                value={engineGroup}
                onChange={(e) => setEngineGroup(e.target.value)}
                placeholder="default"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Main Stream URL <span className="text-crit">*</span>
              </label>
              <input
                disabled={!isSuperadmin}
                type="text"
                required
                value={mainStreamUrl}
                onChange={(e) => setMainStreamUrl(e.target.value)}
                placeholder="rtsp://192.168.1.100:554/ch0/main"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none"
              />
              {fieldErrors["mainStreamUrl"] && (
                <p className="mt-1 text-[11px] font-bold text-crit">{fieldErrors["mainStreamUrl"]}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Sub Stream URL (Opsional)
              </label>
              <input
                disabled={!isSuperadmin}
                type="text"
                value={subStreamUrl}
                onChange={(e) => setSubStreamUrl(e.target.value)}
                placeholder="rtsp://192.168.1.100:554/ch0/sub"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Target Frame Rate (FPS)
              </label>
              <input
                disabled={!isSuperadmin}
                type="number"
                min={1}
                max={60}
                value={targetFps}
                onChange={(e) => setTargetFps(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Stream untuk Inferensi AI
              </label>
              <select
                disabled={!isSuperadmin}
                value={inferenceStream}
                onChange={(e) => setInferenceStream(e.target.value as StreamChoice)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none"
              >
                <option value="MAIN">Main Stream (Resolusi Penuh)</option>
                <option value="SUB">Sub Stream (Hemat Bandwidth & Komputasi)</option>
              </select>
            </div>

            <div className="sm:col-span-2 pt-2">
              <div className="flex items-center gap-2">
                <input
                  disabled={!isSuperadmin}
                  id="edit-audit"
                  type="checkbox"
                  checked={auditCamera}
                  onChange={(e) => setAuditCamera(e.target.checked)}
                  className="size-4 rounded border-line text-forest focus:ring-lime disabled:opacity-50"
                />
                <label htmlFor="edit-audit" className="text-xs font-bold text-ink cursor-pointer">
                  Kamera Audit Sensitif (Setiap perubahan konfigurasi memicu alert di System Log)
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Incident Recording */}
        <Card
          title="Perekaman Klip Insiden"
          subtitle="Buffer video sebelum & sesudah kejadian untuk verifikasi bukti"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                disabled={!isSuperadmin}
                id="rec-enabled-edit"
                type="checkbox"
                checked={recordingEnabled}
                onChange={(e) => setRecordingEnabled(e.target.checked)}
                className="size-4 rounded border-line text-forest focus:ring-lime disabled:opacity-50"
              />
              <label htmlFor="rec-enabled-edit" className="text-xs font-bold text-ink cursor-pointer">
                Aktifkan Perekaman Klip Insiden
              </label>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Masa Retensi (Hari)
              </label>
              <input
                disabled={!isSuperadmin}
                type="number"
                min={1}
                max={3650}
                value={retentionDays}
                placeholder="ikut pengaturan situs"
                onChange={(e) => setRetentionDays(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Retensi bukti (hari)
              </label>
              <input
                disabled={!isSuperadmin}
                type="number"
                min={1}
                max={3650}
                value={evidenceRetentionDays}
                placeholder="ikut pengaturan situs"
                onChange={(e) => setEvidenceRetentionDays(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none"
              />
              {fieldErrors["recording.evidenceRetentionDays"] && (
                <p className="mt-1 text-[11px] font-bold text-crit">{fieldErrors["recording.evidenceRetentionDays"]}</p>
              )}
              <p className="mt-1 text-[11px] text-muted">
                Menurunkan nilai ini menghapus klip bukti yang lebih lama pada pembersihan berikutnya (setiap jam).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Klip Sebelum (Detik)
                </label>
                <input
                  disabled={!isSuperadmin}
                  type="number"
                  min={0}
                  max={60}
                  value={clipBeforeSec}
                  onChange={(e) => setClipBeforeSec(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Klip Sesudah (Detik)
                </label>
                <input
                  disabled={!isSuperadmin}
                  type="number"
                  min={0}
                  max={120}
                  value={clipAfterSec}
                  onChange={(e) => setClipAfterSec(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink disabled:bg-surface-2 disabled:text-muted focus:border-lime focus:outline-none"
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/config/cameras"
            className="rounded-xl border border-line px-5 py-2.5 text-xs font-bold text-ink-2 hover:bg-surface-2"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-6 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-forest-dark hover:shadow-lg disabled:opacity-50"
          >
            <Save className="size-4" />
            {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </>
  );
}

export function CameraEditPage({ id }: { id: string }) {
  const { me } = useMe();
  const isSuperadmin = roleAtLeast(me?.role ?? "USER", "SUPERADMIN");

  const cameraQuery = useCamerasGet(id);
  const usecasesQuery = useUsecasesList();

  const camera = cameraQuery.data;
  const usecase = (usecasesQuery.data ?? []).find((u) => u.id === camera?.useCase);

  return (
    <RequireRole min="MANAGER">
      <Link
        href="/config/cameras"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-muted transition hover:text-forest"
      >
        <ArrowLeft className="size-4" />
        Semua kamera
      </Link>

      <PageHeader
        title={camera?.name ?? id}
        subtitle="Pengaturan kamera: identitas, status aktif, dan stream video."
      />
      <CameraTabs id={id} />

      {cameraQuery.isLoading ? (
        <Card>
          <div className="py-12 text-center text-xs font-bold text-muted">Memuat data kamera...</div>
        </Card>
      ) : !camera ? (
        <Card>
          <div className="py-12 text-center text-xs font-bold text-crit">Kamera tidak ditemukan.</div>
        </Card>
      ) : (
        <CameraEditForm
          key={camera.id}
          id={id}
          camera={camera}
          isSuperadmin={isSuperadmin}
          usecase={usecase}
        />
      )}
    </RequireRole>
  );
}
