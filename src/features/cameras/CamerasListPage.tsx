"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Camera, 
  Plus, 
  Trash2, 
  Sliders, 
  Edit3, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter
} from "lucide-react";
import { useCamerasList, useCamerasRemove } from "@/api/generated/cameras/cameras";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import { useStatus } from "@/live";
import { useMe } from "@/auth/AuthProvider";
import { roleAtLeast } from "@/auth/roles";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader, Card, Table, OnlineBadge, Badge, Mono } from "@/components/ui";
import { ApiError } from "@/api/http";
import { useQueryClient } from "@tanstack/react-query";

export function CamerasListPage() {
  const { me } = useMe();
  const isSuperadmin = roleAtLeast(me?.role ?? "USER", "SUPERADMIN");
  const queryClient = useQueryClient();

  const camerasQuery = useCamerasList();
  const usecasesQuery = useUsecasesList();
  const { cameras: liveStatus } = useStatus();

  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("ALL");
  const [selectedUsecase, setSelectedUsecase] = useState<string>("ALL");

  const [deletingCamera, setDeletingCamera] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const removeMutation = useCamerasRemove({
    mutation: {
      onSuccess: () => {
        setDeletingCamera(null);
        setDeleteError(null);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/cameras`] });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.code === "CAMERA_HAS_DATA") {
            setDeleteError("Kamera memiliki data analitik dan tidak dapat dihapus. Silakan nonaktifkan saja kamera ini melalui menu Edit.");
          } else {
            setDeleteError(err.message || "Gagal menghapus kamera.");
          }
        } else {
          setDeleteError("Terjadi kesalahan saat menghapus kamera.");
        }
      },
    },
  });

  const usecasesMap = new Map((usecasesQuery.data ?? []).map((u) => [u.id, u.label]));

  const cameras = camerasQuery.data ?? [];
  const areas = Array.from(new Set(cameras.map((c) => c.area).filter(Boolean))) as string[];

  const filteredCameras = cameras.filter((cam) => {
    const matchSearch =
      cam.name.toLowerCase().includes(search.toLowerCase()) ||
      cam.id.toLowerCase().includes(search.toLowerCase()) ||
      (cam.area ?? "").toLowerCase().includes(search.toLowerCase());
    const matchArea = selectedArea === "ALL" || cam.area === selectedArea;
    const matchUsecase = selectedUsecase === "ALL" || cam.useCase === selectedUsecase;
    return matchSearch && matchArea && matchUsecase;
  });

  return (
    <RequireRole min="MANAGER">
      <PageHeader
        tag="Konfigurasi Sistem"
        title="Manajemen Kamera AI"
        subtitle="Daftar sensor video CCTV, use-case analitik, versi konfigurasi, dan status stream operasional"
      >
        {isSuperadmin && (
          <Link
            href="/config/cameras/new"
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-black text-white shadow-md transition-all hover:bg-forest-dark hover:shadow-lg active:scale-95"
          >
            <Plus className="size-4" />
            Tambah Kamera
          </Link>
        )}
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari ID, nama, atau area kamera..."
            className="w-full rounded-2xl border border-line bg-surface py-2.5 pl-10 pr-4 text-xs font-semibold text-ink placeholder:text-muted focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            aria-label="Filter berdasarkan Area Kamera"
            className="w-full appearance-none rounded-2xl border border-line bg-surface py-2.5 pl-10 pr-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
          >
            <option value="ALL">Semua Area Operasional</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <select
            value={selectedUsecase}
            onChange={(e) => setSelectedUsecase(e.target.value)}
            aria-label="Filter berdasarkan Use Case Analitik"
            className="w-full appearance-none rounded-2xl border border-line bg-surface py-2.5 px-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime/20"
          >
            <option value="ALL">Semua Use-Case Analitik</option>
            {(usecasesQuery.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} ({u.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card
        title={`Daftar Kamera CCTV (${filteredCameras.length} Kamera)`}
        subtitle="Status online, use case, dan sinkronisasi versi mesin AI vision"
      >
        <Table
          head={[
            "ID & Nama Kamera",
            "Area & Use Case",
            "Status Sensor",
            "Versi Konfigurasi",
            "Aksi",
          ]}
          rows={filteredCameras.map((cam) => {
            const status = liveStatus[cam.id];
            const isOnline = status !== undefined && status !== null;
            const appliedVer = status?.appliedVersion;
            const activeVer = cam.activeVersion;
            const isSynced = appliedVer === activeVer;

            return [
              <div key="name" className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-forest">{cam.name}</span>
                  {!cam.enabled && (
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">
                      Nonaktif
                    </span>
                  )}
                  {cam.auditCamera && (
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                      Audit
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted">
                  <Mono>{cam.id}</Mono>
                </span>
              </div>,

              <div key="meta" className="flex flex-col">
                <span className="font-semibold text-ink">{cam.area ?? "—"}</span>
                <span className="text-[11px] text-muted">
                  {usecasesMap.get(cam.useCase) ?? cam.useCase}
                </span>
              </div>,

              <div key="status" className="flex flex-col gap-1">
                <OnlineBadge online={isOnline} />
                {isOnline && status?.fps !== undefined && (
                  <span className="text-[10px] font-semibold text-muted">
                    {status.fps.toFixed(1)} FPS
                  </span>
                )}
              </div>,

              <div key="ver" className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-ink">v{activeVer}</span>
                  {appliedVer !== undefined ? (
                    isSynced ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 className="size-3" /> Diterapkan (v{appliedVer})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600">
                        <Clock className="size-3" /> Menerapkan (v{appliedVer ?? 0} → v{activeVer})
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-muted">—</span>
                  )}
                </div>
                {status?.configError && (
                  <span className="text-[10px] font-semibold text-red-600">
                    Ditolak: {status.configError}
                  </span>
                )}
              </div>,

              <div key="actions" className="flex items-center gap-1.5">
                <Link
                  href={`/config/cameras/${cam.id}/zones`}
                  title="Editor Zona & Parameter"
                  className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-forest transition hover:border-lime hover:bg-lime/10"
                >
                  <Sliders className="size-3.5" />
                  <span>Zona</span>
                </Link>

                <Link
                  href={`/config/cameras/${cam.id}`}
                  title="Edit Pengaturan Kamera"
                  className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-ink-2 transition hover:border-lime hover:bg-lime/10"
                >
                  <Edit3 className="size-3.5" />
                  <span>Edit</span>
                </Link>

                {isSuperadmin && (
                  <button
                    type="button"
                    title="Hapus Kamera"
                    onClick={() => {
                      setDeletingCamera({ id: cam.id, name: cam.name });
                      setDeleteError(null);
                    }}
                    className="grid size-8 place-items-center rounded-xl text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>,
            ];
          })}
          empty={
            camerasQuery.isLoading
              ? "Memuat daftar kamera..."
              : filteredCameras.length === 0
              ? "Tidak ada kamera yang cocok dengan kriteria pencarian."
              : undefined
          }
        />
      </Card>

      {/* Delete Confirmation Modal */}
      {deletingCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <div className="grid size-10 place-items-center rounded-2xl bg-red-100">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-ink">Konfirmasi Hapus Kamera</h3>
                <p className="text-xs font-semibold text-muted">ID: {deletingCamera.id}</p>
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold text-ink-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus kamera <strong className="text-ink">{deletingCamera.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>

            {deleteError && (
              <div role="alert" className="mt-3 rounded-2xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingCamera(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-2 hover:bg-surface-2"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate({ id: deletingCamera.id })}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removeMutation.isPending ? "Menghapus..." : "Hapus Kamera"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RequireRole>
  );
}
