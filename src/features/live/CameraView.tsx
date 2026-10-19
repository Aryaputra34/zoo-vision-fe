'use client';

import React, { useState } from 'react';
import { Bug, Sliders, X } from 'lucide-react';
import type { CameraViewDto } from '@/api/generated/zooVisionAPI.schemas';
import type { CameraStatus } from '@/contract/web';
import { useCameraConfigActive } from '@/api/generated/camera-config/camera-config';
import { useMe } from '@/auth/AuthProvider';
import { LiveVideo } from '@/video/LiveVideo';
import { BoxOverlay } from '@/video/BoxOverlay';
import { StreamPanel } from '@/features/cameras/StreamPanel';

export interface CameraViewProps {
  camera: CameraViewDto;
  status: CameraStatus | null | undefined;
  onClose: () => void;
  usecaseLabel?: string;
}

export function CameraView({
  camera,
  status,
  onClose,
  usecaseLabel,
}: CameraViewProps) {
  const { me } = useMe();
  const isSuperAdmin = me?.role === 'SUPERADMIN';
  const isManagerOrAbove = me?.role === 'SUPERADMIN' || me?.role === 'MANAGER';

  const [isDebug, setIsDebug] = useState(false);
  const [extraDelayMs, setExtraDelayMs] = useState(0);

  const activeConfig = useCameraConfigActive(camera.id, {
    query: {
      enabled: !!camera.id,
    },
  });

  // Preference when opened: main stream -> sub stream -> 2s still frame
  const primaryUrl = camera.liveUrls?.main ?? camera.liveUrls?.sub ?? null;
  const fallbackUrl = camera.liveUrls?.main ? (camera.liveUrls?.sub ?? null) : null;
  const isOnline = status !== undefined && status !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line p-4 sm:p-5">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-black text-ink">{camera.name}</h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isOnline
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-zinc-200 bg-zinc-100 text-zinc-500'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    isOnline ? 'bg-emerald-500 camera-pulse' : 'bg-zinc-400'
                  }`}
                />
                {isOnline
                  ? `${status?.state ?? 'ONLINE'} · ${status?.fps !== undefined ? `${status.fps.toFixed(1)} FPS` : ''}`
                  : 'OFFLINE'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              ID: {camera.id} · Area: {camera.area ?? 'Utama'} · Use Case:{' '}
              {usecaseLabel ?? camera.useCase}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* SUPERADMIN: Debug toggle */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsDebug(!isDebug)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  isDebug
                    ? 'border-purple-300 bg-purple-100 text-purple-900 shadow-xs'
                    : 'border-line bg-surface-2 text-ink-2 hover:bg-surface-3'
                }`}
              >
                <Bug className="size-3.5 text-purple-600" />
                <span>Debug Frame</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="rounded-xl border border-line p-2 text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Video / Debug Screen container */}
        <div className="relative aspect-video w-full overflow-hidden bg-black flex items-center justify-center">
          {isDebug ? (
            // Debug view: unmounts player, displays direct server annotated MJPEG debug frames
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/media/debug/${camera.id}`}
              alt={`Debug Stream ${camera.name}`}
              className="size-full object-contain"
            />
          ) : (
            <LiveVideo
              cameraId={camera.id}
              alt={`Snapshot Kamera ${camera.name}`}
              url={primaryUrl}
              fallbackUrl={fallbackUrl}
              emptyText={isOnline ? 'Menunggu frame...' : 'Kamera offline'}
              overlay={(video, reader) => (
                <BoxOverlay
                  video={video}
                  cameraId={camera.id}
                  settings={activeConfig.data?.settings}
                  extraDelayMs={extraDelayMs}
                  reader={reader}
                />
              )}
            />
          )}
        </div>

        {/* Modal Controls / Footer */}
        <div className="flex flex-col gap-3 overflow-y-auto border-t border-line bg-surface-2 p-4">
          {/* SUPERADMIN: Delay Slider */}
          {isSuperAdmin && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <Sliders className="size-4 text-forest" />
                <div>
                  <div className="text-xs font-bold text-ink">
                    Kompensasi Delay Kotak Deteksi (AI Bounding Box)
                  </div>
                  <div className="text-[10px] text-muted">
                    Menyesuaikan keselarasan waktu kotak AI terhadap render video (−500 ms s/d +1000 ms)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={-500}
                  max={1000}
                  step={50}
                  value={extraDelayMs}
                  onChange={(e) => setExtraDelayMs(Number(e.target.value))}
                  className="h-2 w-40 cursor-pointer accent-forest"
                />
                <span className="w-16 text-right font-mono text-xs font-bold text-ink">
                  {extraDelayMs >= 0 ? `+${extraDelayMs}` : extraDelayMs} ms
                </span>
                {extraDelayMs !== 0 && (
                  <button
                    type="button"
                    onClick={() => setExtraDelayMs(0)}
                    className="text-[10px] font-semibold text-muted underline hover:text-ink"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {/* MANAGER & SUPERADMIN: StreamPanel (Task V4) */}
          {isManagerOrAbove && (
            <StreamPanel cameraId={camera.id} />
          )}
        </div>
      </div>
    </div>
  );
}

export default CameraView;
