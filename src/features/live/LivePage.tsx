"use client";

import { useState, useEffect } from "react";
import {
  Cctv,
  Maximize2,
  X,
  Search,
  Filter,
} from "lucide-react";
import { useCamerasList } from "@/api/generated/cameras/cameras";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import { useStatus } from "@/live";
import { PageHeader, Card, OnlineBadge } from "@/components/ui";
import { LivePausedBadge } from "@/components/LivePausedBadge";
import type { CameraViewDto } from "@/api/generated/zooVisionAPI.schemas";

export function LivePage() {
  const camerasQuery = useCamerasList();
  const usecasesQuery = useUsecasesList();
  const { cameras: liveStatus } = useStatus();

  // Search & Filter
  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("ALL");

  // Selected camera for enlarged view
  const [enlargedCamera, setEnlargedCamera] = useState<CameraViewDto | null>(null);

  // 2s interval frame ticker
  const [frameTick, setFrameTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setFrameTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const cameras = (camerasQuery.data ?? []).filter((c) => c.enabled);
  const areas = Array.from(new Set(cameras.map((c) => c.area).filter(Boolean))) as string[];
  const usecasesMap = new Map((usecasesQuery.data ?? []).map((u) => [u.id, u.label]));

  const filteredCameras = cameras.filter((cam) => {
    const matchSearch =
      cam.name.toLowerCase().includes(search.toLowerCase()) ||
      cam.id.toLowerCase().includes(search.toLowerCase()) ||
      (cam.area ?? "").toLowerCase().includes(search.toLowerCase());
    const matchArea = selectedArea === "ALL" || cam.area === selectedArea;
    return matchSearch && matchArea;
  });

  return (
    <>
      <PageHeader
        tag="Taman Safari Bogor · Sensor Hub"
        title="Pemantauan Kamera AI Langsung (Live View)"
        subtitle="Grid feed visual sensor kamera CCTV aktif dengan pembaruan snapshot 2 detik dan telemetri status mesin"
      >
        <LivePausedBadge />
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kamera CCTV berdasarkan nama, ID, atau area..."
            className="w-full rounded-2xl border border-line bg-surface py-2.5 pl-10 pr-4 text-xs font-semibold text-ink placeholder:text-muted focus:border-lime focus:outline-none"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            aria-label="Filter Area"
            className="w-full appearance-none rounded-2xl border border-line bg-surface py-2.5 pl-10 pr-4 text-xs font-semibold text-ink focus:border-lime focus:outline-none"
          >
            <option value="ALL">Semua Area Operasional</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Camera Grid */}
      {filteredCameras.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCameras.map((cam) => {
            const status = liveStatus[cam.id];
            const isOnline = status !== undefined && status !== null;
            const live = (status?.live ?? {}) as Record<string, unknown>;

            return (
              <div
                key={cam.id}
                onClick={() => setEnlargedCamera(cam)}
                className="group relative cursor-pointer overflow-hidden rounded-[24px] border border-line bg-surface shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-lime/60 hover:shadow-xl"
              >
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-line/60 p-4">
                  <div>
                    <h3 className="text-xs font-black text-forest group-hover:text-forest-dark">
                      {cam.name}
                    </h3>
                    <p className="text-[10px] text-muted">
                      {cam.area ?? "Area Utama"} · {usecasesMap.get(cam.useCase) ?? cam.useCase}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isOnline ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200">
                        <span className="size-1.5 rounded-full bg-emerald-500 camera-pulse" />
                        {status?.fps !== undefined ? `${status.fps.toFixed(1)} FPS` : "Online"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                        <span className="size-1.5 rounded-full bg-zinc-400" />
                        Offline
                      </span>
                    )}
                  </div>
                </div>

                {/* 16:9 Frame Preview */}
                <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden">
                  <CameraFrameImage
                    cameraId={cam.id}
                    isOnline={isOnline}
                    tick={frameTick}
                  />

                  {/* Hover expand overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-xs transition group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-forest/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                      <Maximize2 className="size-3.5 text-lime" />
                      Perbesar Gambar
                    </span>
                  </div>
                </div>

                {/* Footer Telemetry counters */}
                <div className="border-t border-line/60 bg-surface-2 p-3 text-[11px] font-semibold text-ink-2">
                  <LiveCounters useCase={cam.useCase} live={live} isOnline={isOnline} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="py-16 text-center text-xs font-bold text-muted">
            Tidak ada kamera aktif yang cocok dengan kriteria pencarian.
          </div>
        </Card>
      )}

      {/* Enlarged Camera Modal */}
      {enlargedCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line p-5">
              <div>
                <h3 className="text-base font-black text-ink">{enlargedCamera.name}</h3>
                <p className="text-xs text-muted">
                  ID: {enlargedCamera.id} · Area: {enlargedCamera.area ?? "Umum"} · Use Case:{" "}
                  {usecasesMap.get(enlargedCamera.useCase) ?? enlargedCamera.useCase}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <OnlineBadge
                  online={
                    liveStatus[enlargedCamera.id] !== undefined &&
                    liveStatus[enlargedCamera.id] !== null
                  }
                />
                <button
                  type="button"
                  onClick={() => setEnlargedCamera(null)}
                  className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* High-res Frame */}
            <div className="relative aspect-video w-full bg-zinc-950">
              <CameraFrameImage
                cameraId={enlargedCamera.id}
                isOnline={
                  liveStatus[enlargedCamera.id] !== undefined &&
                  liveStatus[enlargedCamera.id] !== null
                }
                tick={frameTick}
              />
            </div>

            {/* Modal Footer info */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line p-5 bg-surface-2 text-xs">
              <div className="space-y-1">
                <div className="font-bold text-ink">Telemetri Live:</div>
                <LiveCounters
                  useCase={enlargedCamera.useCase}
                  live={(liveStatus[enlargedCamera.id]?.live ?? {}) as Record<string, unknown>}
                  isOnline={
                    liveStatus[enlargedCamera.id] !== undefined &&
                    liveStatus[enlargedCamera.id] !== null
                  }
                />
              </div>

              <div className="rounded-xl border border-lime/30 bg-lime/10 px-3 py-2 text-[11px] font-bold text-forest">
                Catatan: Mode video stream interaktif WebRTC/HLS akan tersedia pada Fase 4.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Subcomponent for Camera frame image with error handling
function CameraFrameImage({
  cameraId,
  isOnline,
  tick,
}: {
  cameraId: string;
  isOnline: boolean;
  tick: number;
}) {
  const [loadError, setLoadError] = useState(false);
  const [lastValidSrc, setLastValidSrc] = useState<string | null>(null);

  const currentSrc = `/api/v1/cameras/${cameraId}/frame?t=${tick}`;

  return (
    <div className="relative size-full flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentSrc}
        alt={`Live Feed Camera ${cameraId}`}
        onLoad={() => {
          setLoadError(false);
          setLastValidSrc(currentSrc);
        }}
        onError={() => setLoadError(true)}
        className={`size-full object-contain ${loadError && !lastValidSrc ? "hidden" : "block"}`}
      />

      {loadError && !lastValidSrc && (
        <div className="flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
          <Cctv className="size-8 text-zinc-600 mb-1" />
          <span className="text-[11px] font-bold">
            {isOnline ? "Menunggu Frame dari Kamera..." : "Kamera Sedang Offline"}
          </span>
        </div>
      )}
    </div>
  );
}

// Live counters helper
function LiveCounters({
  useCase,
  live,
  isOnline,
}: {
  useCase: string;
  live: Record<string, unknown>;
  isOnline: boolean;
}) {
  if (!isOnline) {
    return <span className="text-muted">Kamera sensor sedang tidak aktif</span>;
  }

  if (useCase === "vehicle_gate") {
    return (
      <div className="flex items-center gap-3">
        <span>Masuk: <strong className="text-forest">{Number(live.inCount ?? 0)}</strong></span>
        <span>Keluar: <strong className="text-amber-600">{Number(live.outCount ?? 0)}</strong></span>
      </div>
    );
  }

  if (useCase === "horse_riding") {
    return (
      <div className="flex items-center gap-3">
        <span>Kuda di Lintasan: <strong className="text-forest">{Number(live.activeHorses ?? 0)}</strong></span>
        <span>Berangkat: <strong className="text-ink">{Number(live.departures ?? 0)}</strong></span>
      </div>
    );
  }

  if (useCase === "cashier_presence") {
    return (
      <div className="flex items-center gap-3">
        <span>Status: <strong className="text-forest">{String(live.state ?? "MANNED")}</strong></span>
        <span>Staf: <strong className="text-ink">{Number(live.clerkCount ?? 0)}</strong></span>
        <span>Antre: <strong className="text-amber-600">{Number(live.visitorCount ?? 0)}</strong></span>
      </div>
    );
  }

  if (useCase === "restaurant_counter" || useCase === "restaurant_table") {
    return (
      <div className="flex items-center gap-3">
        <span>Okupansi: <strong className="text-forest">{Number(live.occupancy ?? 0)} Tamu</strong></span>
        <span>Meja Terisi: <strong className="text-ink">{Number(live.occupiedTables ?? 0)}</strong></span>
      </div>
    );
  }

  // Fallback for custom or unknown use cases
  const entries = Object.entries(live).filter(([, v]) => typeof v === "number" || typeof v === "string");
  if (entries.length === 0) {
    return <span className="text-muted">Sedang memproses analitik frame...</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries.slice(0, 3).map(([k, v]) => (
        <span key={k}>
          {k}: <strong className="text-forest">{String(v)}</strong>
        </span>
      ))}
    </div>
  );
}
