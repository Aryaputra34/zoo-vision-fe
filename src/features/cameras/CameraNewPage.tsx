"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { useCamerasCreate } from "@/api/generated/cameras/cameras";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader, Card } from "@/components/ui";
import { ApiError } from "@/api/http";
import type { CreateCameraDto, SourceType, StreamChoice } from "@/api/generated/zooVisionAPI.schemas";

export function CameraNewPage() {
  const router = useRouter();
  const usecasesQuery = useUsecasesList();

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [useCase, setUseCase] = useState("vehicle_gate");
  const [sourceType, setSourceType] = useState<SourceType>("RTSP");
  const [mainStreamUrl, setMainStreamUrl] = useState("");
  const [subStreamUrl, setSubStreamUrl] = useState("");
  const [engineGroup, setEngineGroup] = useState("default");
  const [targetFps, setTargetFps] = useState(15);
  const [inferenceStream, setInferenceStream] = useState<StreamChoice>("MAIN");
  const [auditCamera, setAuditCamera] = useState(false);
  const [note, setNote] = useState("");

  // Recording
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [clipBeforeSec, setClipBeforeSec] = useState(5);
  const [clipAfterSec, setClipAfterSec] = useState(15);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const createMutation = useCamerasCreate({
    mutation: {
      onSuccess: (data) => {
        router.push(`/config/cameras/${data.id}/zones`);
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.errors && err.errors.length > 0) {
            const errs: Record<string, string> = {};
            for (const item of err.errors) {
              const key = item.path.replace(/^\//, "").replace(/\//g, ".");
              errs[key] = item.message;
            }
            setFieldErrors(errs);
            setGeneralError(err.message || "Terdapat kesalahan validasi pada formulir.");
          } else {
            setGeneralError(err.message || "Gagal membuat kamera baru.");
          }
        } else {
          setGeneralError("Terjadi kesalahan sistem saat membuat kamera.");
        }
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    // Initial default settings from selected use case if available
    const selectedUc = (usecasesQuery.data ?? []).find((u) => u.id === useCase);
    const defaultSettings =
      selectedUc?.settingsSchema && typeof selectedUc.settingsSchema === "object" && "default" in selectedUc.settingsSchema
        ? (selectedUc.settingsSchema.default as Record<string, unknown>)
        : {};

    const payload: CreateCameraDto = {
      id: id.trim(),
      name: name.trim(),
      area: area.trim() ? area.trim() : null,
      useCase,
      sourceType,
      mainStreamUrl: mainStreamUrl.trim(),
      subStreamUrl: subStreamUrl.trim() ? subStreamUrl.trim() : null,
      engineGroup: engineGroup.trim() ? engineGroup.trim() : "default",
      targetFps: Number(targetFps),
      inferenceStream,
      auditCamera,
      note: note.trim() ? note.trim() : undefined,
      settings: defaultSettings ?? {},
      recording: {
        enabled: recordingEnabled,
        stream: inferenceStream,
        retentionDays: Number(retentionDays),
        clipBeforeSec: Number(clipBeforeSec),
        clipAfterSec: Number(clipAfterSec),
      },
    };

    createMutation.mutate({ data: payload });
  };

  const assignableUsecases = (usecasesQuery.data ?? []).filter((u) => u.assignable !== false);

  return (
    <RequireRole min="SUPERADMIN">
      <div className="mb-4">
        <Link
          href="/config/cameras"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted transition hover:text-forest"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Daftar Kamera
        </Link>
      </div>

      <PageHeader
        tag="Superadmin Only"
        title="Tambah Kamera CCTV Baru"
        subtitle="Registrasikan stream video RTSP sensor AI dan asosiasikan dengan use-case analitik"
      />

      {generalError && (
        <div role="alert" className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-xs font-bold text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600" />
            <span>{generalError}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Identitas & Lokasi Kamera" subtitle="Pengenal unik dan penempatan sensor di area Taman Safari">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cam-id" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                ID Kamera <span className="text-red-500">*</span>
              </label>
              <p className="mb-1.5 text-[11px] text-muted">Huruf kecil, angka, garis bawah (misal: gate_car_1)</p>
              <input
                id="cam-id"
                type="text"
                required
                pattern="^[a-z][a-z0-9_]{2,63}$"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="gate_car_1"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              />
              {fieldErrors["id"] && (
                <p className="mt-1 text-[11px] font-bold text-red-600">{fieldErrors["id"]}</p>
              )}
            </div>

            <div>
              <label htmlFor="cam-name" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Nama Kamera <span className="text-red-500">*</span>
              </label>
              <p className="mb-1.5 text-[11px] text-muted">Label deskriptif (misal: Gerbang Masuk Mobil 1)</p>
              <input
                id="cam-name"
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gerbang Masuk Mobil 1"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              />
              {fieldErrors["name"] && (
                <p className="mt-1 text-[11px] font-bold text-red-600">{fieldErrors["name"]}</p>
              )}
            </div>

            <div>
              <label htmlFor="cam-area" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Area Operasional
              </label>
              <p className="mb-1.5 text-[11px] text-muted">Zona atau wahana (misal: Gerbang Utama, Rainforest Resto)</p>
              <input
                id="cam-area"
                type="text"
                maxLength={100}
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Gerbang Utama"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              />
              {fieldErrors["area"] && (
                <p className="mt-1 text-[11px] font-bold text-red-600">{fieldErrors["area"]}</p>
              )}
            </div>

            <div>
              <label htmlFor="cam-usecase" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Use-Case Analitik AI <span className="text-red-500">*</span>
              </label>
              <p className="mb-1.5 text-[11px] text-muted">Model logika analitik dan penghitungan visual</p>
              <select
                id="cam-usecase"
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              >
                {assignableUsecases.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label} ({u.id})
                  </option>
                ))}
              </select>
              {fieldErrors["useCase"] && (
                <p className="mt-1 text-[11px] font-bold text-red-600">{fieldErrors["useCase"]}</p>
              )}
            </div>
          </div>
        </Card>

        <Card title="Konfigurasi Stream Video (RTSP)" subtitle="Alamat URL stream sensor kamera CCTV (Tersimpan terenkripsi)">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cam-source" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Tipe Sumber Stream
              </label>
              <select
                id="cam-source"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              >
                <option value="RTSP">RTSP (Real-Time Streaming Protocol)</option>
                <option value="MEDIAMTX">MediaMTX Re-stream</option>
                <option value="NX">Network Optix (Nx Witness)</option>
                <option value="FILE">File Video Demo / Uji Coba</option>
              </select>
            </div>

            <div>
              <label htmlFor="cam-engine" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Engine Group
              </label>
              <input
                id="cam-engine"
                type="text"
                pattern="^[a-z0-9_-]{1,32}$"
                value={engineGroup}
                onChange={(e) => setEngineGroup(e.target.value)}
                placeholder="default"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              />
              {fieldErrors["engineGroup"] && (
                <p className="mt-1 text-[11px] font-bold text-red-600">{fieldErrors["engineGroup"]}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cam-mainstream" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Main Stream URL <span className="text-red-500">*</span>
              </label>
              <p className="mb-1 text-[11px] text-muted">Contoh: rtsp://admin:password@192.168.1.100:554/stream1</p>
              <input
                id="cam-mainstream"
                type="text"
                required
                value={mainStreamUrl}
                onChange={(e) => setMainStreamUrl(e.target.value)}
                placeholder="rtsp://admin:password@192.168.1.100:554/stream1"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              />
              {fieldErrors["mainStreamUrl"] && (
                <p className="mt-1 text-[11px] font-bold text-red-600">{fieldErrors["mainStreamUrl"]}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cam-substream" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Sub Stream URL (Opsional)
              </label>
              <p className="mb-1 text-[11px] text-muted">Stream resolusi lebih rendah untuk inferensi ringan atau grid multi-view</p>
              <input
                id="cam-substream"
                type="text"
                value={subStreamUrl}
                onChange={(e) => setSubStreamUrl(e.target.value)}
                placeholder="rtsp://admin:password@192.168.1.100:554/stream2"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              />
              {fieldErrors["subStreamUrl"] && (
                <p className="mt-1 text-[11px] font-bold text-red-600">{fieldErrors["subStreamUrl"]}</p>
              )}
            </div>

            <div>
              <label htmlFor="cam-fps" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Target Frame Rate (FPS)
              </label>
              <input
                id="cam-fps"
                type="number"
                min={1}
                max={30}
                value={targetFps}
                onChange={(e) => setTargetFps(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              />
              {fieldErrors["targetFps"] && (
                <p className="mt-1 text-[11px] font-bold text-red-600">{fieldErrors["targetFps"]}</p>
              )}
            </div>

            <div>
              <label htmlFor="cam-infstream" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Stream Inferensi AI
              </label>
              <select
                id="cam-infstream"
                value={inferenceStream}
                onChange={(e) => setInferenceStream(e.target.value as StreamChoice)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              >
                <option value="MAIN">MAIN (Stream Utama)</option>
                <option value="SUB">SUB (Sub Stream / Resolusi Rendah)</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="cam-audit"
                checked={auditCamera}
                onChange={(e) => setAuditCamera(e.target.checked)}
                className="size-4 rounded border-line text-forest focus:ring-lime"
              />
              <label htmlFor="cam-audit" className="text-xs font-bold text-ink cursor-pointer">
                Tandai sebagai Kamera Audit Sensitif (Perubahan konfigurasi akan memicu notifikasi audit instan)
              </label>
            </div>
          </div>
        </Card>

        <Card
          title="Pengaturan Perekaman Video (Recording Settings)"
          subtitle="Penyimpanan klip video saat terdeteksi kejadian/insiden analitik"
        >
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-xl bg-lime/15 px-3 py-1.5 text-xs font-bold text-forest">
            <Info className="size-4 shrink-0" />
            <span>Catatan: Fitur perekaman akan aktif penuh mulai Fase 4. Konfigurasi disimpan untuk persiapan stack engine.</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="rec-enabled"
                checked={recordingEnabled}
                onChange={(e) => setRecordingEnabled(e.target.checked)}
                className="size-4 rounded border-line text-forest focus:ring-lime"
              />
              <label htmlFor="rec-enabled" className="text-xs font-bold text-ink cursor-pointer">
                Aktifkan Perekaman Klip Insiden
              </label>
            </div>

            <div>
              <label htmlFor="rec-retention" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                Masa Retensi (Hari)
              </label>
              <input
                id="rec-retention"
                type="number"
                min={1}
                max={365}
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="rec-before" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Klip Sebelum (Detik)
                </label>
                <input
                  id="rec-before"
                  type="number"
                  min={0}
                  max={60}
                  value={clipBeforeSec}
                  onChange={(e) => setClipBeforeSec(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
                />
              </div>
              <div>
                <label htmlFor="rec-after" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Klip Sesudah (Detik)
                </label>
                <input
                  id="rec-after"
                  type="number"
                  min={0}
                  max={120}
                  value={clipAfterSec}
                  onChange={(e) => setClipAfterSec(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
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
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-forest-dark hover:shadow-lg disabled:opacity-50"
          >
            <Save className="size-4" />
            {createMutation.isPending ? "Menyimpan Kamera..." : "Simpan & Lanjutkan ke Zona"}
          </button>
        </div>
      </form>
    </RequireRole>
  );
}
