"use client";

import { useState } from "react";
import {
  Cpu,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  Trash2,
  Play,
  FileCheck,
  RefreshCw,
  AlertTriangle,
  Layers,
} from "lucide-react";
import {
  useModelsList,
  useModelsUpload,
  useModelsRescan,
  useModelsValidate,
  useModelsConvert,
  useModelsRemove,
} from "@/api/generated/models/models";
import { useMe } from "@/auth/AuthProvider";
import { roleAtLeast } from "@/auth/roles";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader, Card, Table, Badge, Mono } from "@/components/ui";
import { ApiError } from "@/api/http";
import { useQueryClient } from "@tanstack/react-query";

const ONE_GIB = 1024 * 1024 * 1024; // 1 GiB

export function ModelsPage() {
  const queryClient = useQueryClient();
  const { me } = useMe();
  const isSuperadmin = roleAtLeast(me?.role ?? "USER", "SUPERADMIN");

  // Models list query with conditional 3s polling for active tasks
  const modelsQuery = useModelsList({
    query: {
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data || !Array.isArray(data)) return false;
        const hasActive = data.some(
          (m) => m.status === "VALIDATING" || m.status === "CONVERTING"
        );
        return hasActive ? 3000 : false;
      },
    },
  });

  // Upload Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [modelName, setModelName] = useState("");
  const [modelVersion, setModelVersion] = useState("");
  const [modelNotes, setModelNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Action status / feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [rescanResult, setRescanResult] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState<{ id: string; name: string } | null>(null);

  const uploadMutation = useModelsUpload({
    mutation: {
      onSuccess: () => {
        setUploadSuccess(true);
        setSelectedFile(null);
        setModelName("");
        setModelVersion("");
        setModelNotes("");
        setUploadError(null);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/models`] });
        setTimeout(() => setUploadSuccess(false), 4000);
      },
      onError: (err) => {
        setUploadSuccess(false);
        if (err instanceof ApiError) {
          if (err.code === "TOO_LARGE" || err.statusCode === 413) {
            setUploadError("Ukuran file melebihi batas sistem maksimum 1 GiB (TOO_LARGE).");
          } else {
            setUploadError(err.message || "Gagal mengunggah file model.");
          }
        } else {
          setUploadError("Terjadi kesalahan saat mengunggah model.");
        }
      },
    },
  });

  const rescanMutation = useModelsRescan({
    mutation: {
      onSuccess: (data) => {
        setRescanResult(
          `Rescan selesai: ${data.added.length} model baru ditambahkan, ${data.skipped.length} file dilewati.`
        );
        queryClient.invalidateQueries({ queryKey: [`/api/v1/models`] });
        setTimeout(() => setRescanResult(null), 5000);
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          setActionError(`Rescan gagal: ${err.message}`);
        }
      },
    },
  });

  const validateMutation = useModelsValidate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/models`] });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          setActionError(`Validasi gagal: ${err.message}`);
        }
      },
    },
  });

  const convertMutation = useModelsConvert({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/models`] });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          setActionError(`Konversi gagal: ${err.message}`);
        }
      },
    },
  });

  const removeMutation = useModelsRemove({
    mutation: {
      onSuccess: () => {
        setDeletingModel(null);
        setActionError(null);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/models`] });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.code === "MODEL_IN_USE" || err.statusCode === 409) {
            setActionError(
              `Model sedang aktif digunakan oleh kamera dan tidak dapat dihapus: ${err.message}`
            );
          } else {
            setActionError(err.message || "Gagal menghapus model.");
          }
        } else {
          setActionError("Terjadi kesalahan sistem saat menghapus model.");
        }
      },
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".onnx")) {
      setUploadError("Sistem hanya menerima file model biner berekstensi .onnx.");
      setSelectedFile(null);
      return;
    }

    if (file.size > ONE_GIB) {
      setUploadError("Ukuran file melebihi kapasitas 1 GiB (TOO_LARGE).");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!modelName) {
      setModelName(file.name.replace(/\.onnx$/i, ""));
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    uploadMutation.mutate({
      data: {
        file: selectedFile,
        name: modelName.trim() || undefined,
        version: modelVersion.trim() || undefined,
        notes: modelNotes.trim() || undefined,
      },
    });
  };

  const models = modelsQuery.data ?? [];

  return (
    <RequireRole min="MANAGER">
      <PageHeader
        tag="AI Engine Repository"
        title="Manajemen Model AI Vision"
        subtitle="Repositori bobot neural network, status validasi inferensi ONNX, dan kompatibilitas kamera"
      >
        {isSuperadmin && (
          <button
            type="button"
            disabled={rescanMutation.isPending}
            onClick={() => {
              setActionError(null);
              rescanMutation.mutate();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-forest shadow-sm transition hover:border-lime hover:bg-lime/10 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${rescanMutation.isPending ? "animate-spin" : ""}`} />
            {rescanMutation.isPending ? "Memindai Folder..." : "Pindai Ulang Folder Model"}
          </button>
        )}
      </PageHeader>

      {rescanResult && (
        <div className="mb-6 inline-flex w-full items-center gap-2 rounded-2xl border border-lime/40 bg-lime/20 p-4 text-xs font-bold text-forest">
          <CheckCircle2 className="size-4 text-forest" />
          <span>{rescanResult}</span>
        </div>
      )}

      {actionError && (
        <div role="alert" className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-xs font-bold text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600" />
            <span>{actionError}</span>
          </div>
        </div>
      )}

      {/* Upload Model Card (SUPERADMIN only) */}
      {isSuperadmin && (
        <div className="mb-6">
          <Card
            title="Unggah Model AI Baru (.onnx)"
            subtitle="Hanya menerima format ONNX teroptimasi dengan batas maksimum 1 GiB per file"
          >
            {uploadSuccess && (
              <div className="mb-4 inline-flex w-full items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>Model AI berhasil diunggah dan sedang dijadwalkan untuk validasi otomatis.</span>
              </div>
            )}

            {uploadError && (
              <div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <label htmlFor="model-file-input" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                    Pilih File Model ONNX <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <input
                      id="model-file-input"
                      type="file"
                      accept=".onnx"
                      onChange={handleFileChange}
                      className="block w-full text-xs text-ink file:mr-4 file:rounded-xl file:border-0 file:bg-lime/20 file:px-4 file:py-2.5 file:text-xs file:font-black file:text-forest hover:file:bg-lime/30 cursor-pointer"
                    />
                  </div>
                  {selectedFile && (
                    <p className="mt-1 text-[11px] font-bold text-forest">
                      Ukuran file: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="model-name-input" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                    Nama Model
                  </label>
                  <input
                    id="model-name-input"
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="Misal: yolov8n_safari_animals"
                    className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="model-ver-input" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                    Versi Model
                  </label>
                  <input
                    id="model-ver-input"
                    type="text"
                    value={modelVersion}
                    onChange={(e) => setModelVersion(e.target.value)}
                    placeholder="Misal: 1.0.0"
                    className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="model-notes-input" className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                    Catatan / Dataset
                  </label>
                  <input
                    id="model-notes-input"
                    type="text"
                    value={modelNotes}
                    onChange={(e) => setModelNotes(e.target.value)}
                    placeholder="Pelatihan dataset mamalia zona Afrika"
                    className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-forest-dark disabled:opacity-50"
                >
                  <UploadCloud className="size-4" />
                  {uploadMutation.isPending ? "Mengunggah Model..." : "Unggah Model"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Models Table Card */}
      <Card
        title={`Daftar Model Terdaftar (${models.length} Model)`}
        subtitle="Model yang sedang dalam status VALIDATING atau CONVERTING akan diperbarui otomatis setiap 3 detik"
      >
        <Table
          head={[
            "ID & Nama Model",
            "Format & Sumber",
            "Status",
            "Kelas Objek",
            "Latensi Inferensi",
            "Aksi",
          ]}
          rows={models.map((m) => {
            const validation = m.validation as {
              ok?: boolean;
              latencyMs?: number;
              device?: string;
              error?: string;
            } | null;

            return [
              <div key="name" className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-forest">{m.name}</span>
                  {m.version && (
                    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-2">
                      v{m.version}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted">
                  <Mono>{m.id}</Mono>
                </span>
                {m.notes && <p className="mt-0.5 text-[10px] text-muted italic">{m.notes}</p>}
              </div>,

              <div key="format" className="flex flex-col gap-1">
                <span className="font-mono text-xs font-bold text-ink">{m.format}</span>
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 w-fit">
                  {m.source}
                </span>
              </div>,

              <div key="status" className="flex flex-col gap-1">
                {m.status === "READY" && (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600">
                    <CheckCircle2 className="size-3.5" /> Siap Digunakan
                  </span>
                )}
                {m.status === "VALIDATING" && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                    <RotateCw className="size-3.5 animate-spin" /> Memvalidasi...
                  </span>
                )}
                {m.status === "CONVERTING" && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600">
                    <RotateCw className="size-3.5 animate-spin" /> Mengonversi...
                  </span>
                )}
                {m.status === "UPLOADED" && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-600">
                    <Clock className="size-3.5" /> Menunggu Validasi
                  </span>
                )}
                {m.status === "FAILED" && (
                  <div className="flex flex-col">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                      <AlertCircle className="size-3.5" /> Gagal
                    </span>
                    {validation?.error && (
                      <span className="text-[10px] text-red-600 line-clamp-2" title={validation.error}>
                        {validation.error}
                      </span>
                    )}
                  </div>
                )}
              </div>,

              <div key="classes" className="flex flex-col">
                {m.classNames && m.classNames.length > 0 ? (
                  <>
                    <span className="text-xs font-bold text-ink">
                      {m.classNames.length} Kelas
                    </span>
                    <span className="text-[10px] text-muted line-clamp-1" title={m.classNames.join(", ")}>
                      {m.classNames.join(", ")}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </div>,

              <div key="latency" className="flex flex-col">
                {validation?.latencyMs !== undefined ? (
                  <>
                    <span className="text-xs font-extrabold text-forest">
                      {validation.latencyMs.toFixed(1)} ms
                    </span>
                    {validation.device && (
                      <span className="text-[10px] text-muted">{validation.device}</span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </div>,

              <div key="actions" className="flex items-center gap-1.5">
                {isSuperadmin && (
                  <>
                    <button
                      type="button"
                      title="Jalankan Uji Validasi Mesin"
                      disabled={validateMutation.isPending || m.status === "VALIDATING"}
                      onClick={() => {
                        setActionError(null);
                        validateMutation.mutate({ id: m.id });
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-ink-2 hover:border-lime hover:bg-lime/10 disabled:opacity-40"
                    >
                      <FileCheck className="size-3.5 text-forest" />
                      <span>Validasi</span>
                    </button>

                    {m.format === "PT" && (
                      <button
                        type="button"
                        title="Konversi PyTorch (.pt) ke ONNX"
                        disabled={convertMutation.isPending || m.status === "CONVERTING"}
                        onClick={() => {
                          setActionError(null);
                          convertMutation.mutate({ id: m.id });
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-lime/20 px-2.5 py-1.5 text-xs font-bold text-forest hover:bg-lime/30 disabled:opacity-40"
                      >
                        <RotateCw className="size-3.5" />
                        <span>Konversi</span>
                      </button>
                    )}

                    <button
                      type="button"
                      title="Hapus Model"
                      onClick={() => {
                        setDeletingModel({ id: m.id, name: m.name });
                        setActionError(null);
                      }}
                      className="grid size-8 place-items-center rounded-xl text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>,
            ];
          })}
          empty={
            modelsQuery.isLoading
              ? "Memuat daftar model AI..."
              : models.length === 0
              ? "Belum ada model AI yang terdaftar di sistem."
              : undefined
          }
        />
      </Card>

      {/* Delete Model Confirmation Modal */}
      {deletingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="size-6 text-red-600" />
              <div>
                <h3 className="text-base font-black text-ink">Konfirmasi Hapus Model AI</h3>
                <p className="text-xs font-semibold text-muted">ID: {deletingModel.id}</p>
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold text-ink-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus model AI <strong className="text-ink">{deletingModel.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingModel(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-2 hover:bg-surface-2"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate({ id: deletingModel.id })}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removeMutation.isPending ? "Menghapus..." : "Hapus Model"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RequireRole>
  );
}
