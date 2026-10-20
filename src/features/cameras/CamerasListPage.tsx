"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Sliders, Edit3, AlertTriangle, Search } from "lucide-react";
import { useCamerasList, useCamerasRemove } from "@/api/generated/cameras/cameras";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import { useStatus } from "@/live";
import { useMe } from "@/auth/AuthProvider";
import { roleAtLeast } from "@/auth/roles";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader } from "@/components/ui";
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

  // Status of one camera from the live stream (null = not reporting).
  type St = "on" | "lag" | "off" | "rej" | "dis";
  const stOf = (cam: (typeof cameras)[number]): St => {
    if (!cam.enabled) return "dis";
    const s = liveStatus[cam.id];
    if (!s) return "off";
    if (s.configError) return "rej";
    return s.state === "RUNNING" ? "on" : "lag";
  };
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | St>("ALL");

  const filteredCameras = cameras.filter((cam) => {
    const q = search.toLowerCase();
    const matchSearch =
      cam.name.toLowerCase().includes(q) ||
      cam.id.toLowerCase().includes(q) ||
      (cam.area ?? "").toLowerCase().includes(q);
    const matchArea = selectedArea === "ALL" || cam.area === selectedArea;
    const matchUsecase = selectedUsecase === "ALL" || cam.useCase === selectedUsecase;
    const matchStatus = selectedStatus === "ALL" || stOf(cam) === selectedStatus;
    return matchSearch && matchArea && matchUsecase && matchStatus;
  });

  const groups = Array.from(new Set(filteredCameras.map((c) => c.area || "Lainnya"))).map((area) => ({
    area,
    cams: filteredCameras.filter((c) => (c.area || "Lainnya") === area),
  }));

  const STATUS: Record<St, { t: string; dot: string; chip: string }> = {
    on: { t: "Online", dot: "bg-[#1e8e3e]", chip: "bg-good-bg text-good" },
    lag: { t: "Terjeda", dot: "bg-warn", chip: "bg-warn-bg text-gold-ink" },
    off: { t: "Offline", dot: "bg-off", chip: "bg-off-bg text-[#4b5550]" },
    rej: { t: "Config ditolak", dot: "bg-crit", chip: "bg-crit-bg text-crit-ink" },
    dis: { t: "Nonaktif", dot: "bg-[#b8b2a2]", chip: "bg-surface-2 text-muted" },
  };
  const chips: { id: "ALL" | St; t: string; dot: string }[] = [
    { id: "ALL", t: "Semua", dot: "bg-ink" },
    ...(Object.keys(STATUS) as St[]).map((k) => ({ id: k, t: STATUS[k].t, dot: STATUS[k].dot })),
  ];
  const active = cameras.filter((c) => c.enabled).length;
  const selectCls =
    "h-9 cursor-pointer rounded-[10px] border border-[#cfc9b8] bg-surface px-2.5 text-[13px] font-semibold text-ink focus:border-forest focus:ring-2 focus:ring-lime/40 focus:outline-none";

  return (
    <RequireRole min="MANAGER">
      <PageHeader
        title="Kamera"
        subtitle={
          camerasQuery.isLoading
            ? "Memuat kamera…"
            : `${cameras.length} terdaftar · ${active} aktif. Klik kamera untuk mengatur zona, versi, dan pengaturan.`
        }
      >
        {isSuperadmin ? (
          <Link
            href="/config/cameras/new"
            className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-[10px] bg-lime px-4 text-sm font-bold text-forest-dark transition-colors hover:bg-lime-2"
          >
            <Plus className="size-4" />
            Tambah kamera
          </Link>
        ) : (
          <span className="inline-flex min-h-[38px] items-center rounded-[10px] bg-surface-2 px-3 text-xs font-semibold text-ink-2">
            Tambah/hapus kamera: superadmin
          </span>
        )}
      </PageHeader>

      {/* Status chips, search and filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter status" className="flex flex-wrap gap-1.5">
          {chips.map((c) => {
            const on = selectedStatus === c.id;
            const n = c.id === "ALL" ? cameras.length : cameras.filter((x) => stOf(x) === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelectedStatus(c.id)}
                className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-[13px] font-semibold ${
                  on ? "border-[1.5px] border-lime bg-[#eaf3dc] text-forest" : "border border-[#cfc9b8] bg-surface text-ink hover:bg-surface-2"
                }`}
              >
                <span aria-hidden className={`size-2 rounded-full ${c.dot}`} />
                {c.t}
                <span className="text-xs font-bold text-muted">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} aria-label="Filter berdasarkan Area Kamera" className={selectCls}>
            <option value="ALL">Semua area</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select value={selectedUsecase} onChange={(e) => setSelectedUsecase(e.target.value)} aria-label="Filter berdasarkan Use Case Analitik" className={selectCls}>
            <option value="ALL">Semua use case</option>
            {(usecasesQuery.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <div className="flex h-9 items-center gap-2 rounded-[10px] border border-[#cfc9b8] bg-surface px-2.5 focus-within:border-forest focus-within:ring-2 focus-within:ring-lime/40">
            <Search aria-hidden className="size-4 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari kamera"
              placeholder="Cari nama atau ID"
              className="w-40 bg-transparent text-[13px] font-medium text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(19,36,26,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-xs font-bold text-muted">
                <th className="px-4 py-2.5">Kamera</th>
                <th className="px-4 py-2.5">Use case</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Konfigurasi</th>
                <th className="px-4 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.area}>
                  <tr>
                    <td colSpan={5} className="border-t border-line bg-bg px-4 py-2 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
                      {g.area} · {g.cams.length} kamera
                    </td>
                  </tr>
                  {g.cams.map((cam) => {
                    const status = liveStatus[cam.id];
                    const st = stOf(cam);
                    const appliedVer = status?.appliedVersion;
                    const activeVer = cam.activeVersion;
                    const cfg =
                      !status || appliedVer == null
                        ? { t: `Tersimpan · v${activeVer}`, cls: "bg-surface-2 text-muted" }
                        : status.configError
                          ? { t: `Ditolak · v${activeVer}`, cls: "bg-crit-bg text-crit-ink" }
                          : appliedVer === activeVer
                            ? { t: `Diterapkan · v${activeVer}`, cls: "bg-good-bg text-good" }
                            : { t: `Menunggu engine · v${appliedVer} → v${activeVer}`, cls: "bg-info-bg text-info" };
                    return (
                      <tr key={cam.id} className={`border-t border-line-soft ${cam.enabled ? "" : "opacity-65"}`}>
                        <td className="px-4 py-3">
                          <Link href={`/config/cameras/${cam.id}/zones`} className="flex flex-col hover:underline">
                            <span className="flex items-center gap-2">
                              <span className="font-bold text-ink">{cam.name}</span>
                              {cam.auditCamera && (
                                <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-extrabold text-gold-ink">Kamera audit</span>
                              )}
                            </span>
                            <span className="font-mono text-xs text-muted">{cam.id}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{usecasesMap.get(cam.useCase) ?? cam.useCase}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[st].chip}`}>
                            <span aria-hidden className={`size-1.5 rounded-full ${STATUS[st].dot}`} />
                            {STATUS[st].t}
                            {status && typeof status.fps === "number" ? ` · ${status.fps.toFixed(1)} fps` : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span title={status?.configError ?? undefined} className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.cls}`}>
                            {cfg.t}
                          </span>
                          {status?.configError && <p className="mt-1 max-w-[280px] truncate text-xs text-crit">{status.configError}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/config/cameras/${cam.id}/zones`}
                              className="inline-flex h-8 items-center gap-1 rounded-[9px] bg-forest px-2.5 text-xs font-bold text-white hover:bg-accent-hover"
                            >
                              <Sliders aria-hidden className="size-3.5" /> Zona
                            </Link>
                            <Link
                              href={`/config/cameras/${cam.id}`}
                              className="inline-flex h-8 items-center gap-1 rounded-[9px] border border-[#cfc9b8] px-2.5 text-xs font-bold text-ink hover:bg-surface-2"
                            >
                              <Edit3 aria-hidden className="size-3.5" /> Pengaturan
                            </Link>
                            {isSuperadmin && (
                              <button
                                type="button"
                                title="Hapus kamera"
                                aria-label={`Hapus ${cam.name}`}
                                onClick={() => {
                                  setDeletingCamera({ id: cam.id, name: cam.name });
                                  setDeleteError(null);
                                }}
                                className="grid size-8 cursor-pointer place-items-center rounded-[9px] text-muted transition hover:bg-crit-bg hover:text-crit"
                              >
                                <Trash2 aria-hidden className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {groups.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {camerasQuery.isLoading ? "Memuat daftar kamera…" : "Tidak ada kamera yang cocok dengan filter."}
          </p>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {deletingCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-crit">
              <div className="grid size-10 place-items-center rounded-2xl bg-crit-bg">
                <AlertTriangle className="size-5 text-crit" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-ink">Konfirmasi Hapus Kamera</h3>
                <p className="text-xs font-semibold text-muted">ID: {deletingCamera.id}</p>
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold text-ink-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus kamera <strong className="text-ink">{deletingCamera.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>

            {deleteError && (
              <div role="alert" className="mt-3 rounded-2xl border border-crit/25 bg-crit-bg p-3 text-xs font-bold text-crit-ink">
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
                className="rounded-xl bg-crit px-4 py-2 text-xs font-extrabold text-white hover:bg-crit disabled:opacity-50"
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
