'use client';

import React, { useEffect, useState } from 'react';
import { Cctv, Maximize2 } from 'lucide-react';
import type { CameraViewDto } from '@/api/generated/zooVisionAPI.schemas';
import type { CameraStatus } from '@/contract/web';
import { WhepPlayer } from '@/video/WhepPlayer';

export interface LiveTileProps {
  camera: CameraViewDto;
  status: CameraStatus | null | undefined;
  onClick?: () => void;
  usecaseLabel?: string;
}

export function LiveTile({ camera, status, onClick, usecaseLabel }: LiveTileProps) {
  const [playerFailed, setPlayerFailed] = useState(false);
  const [frameTick, setFrameTick] = useState(0);
  const [stillError, setStillError] = useState(false);

  // Preference: sub stream -> main stream -> 2s still frame
  const liveUrl = camera.liveUrls?.sub ?? camera.liveUrls?.main ?? null;
  const fallbackUrl = camera.liveUrls?.sub ? (camera.liveUrls?.main ?? null) : null;
  const isOnline = status !== undefined && status !== null;

  // Decision 4: Fallback still runs every 2s when there are no liveUrls or player fails
  const useStill = !liveUrl || playerFailed;

  useEffect(() => {
    if (!useStill) return;
    const interval = setInterval(() => {
      setFrameTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [useStill]);

  return (
    <div
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-lime/60 hover:shadow-xl"
    >
      {/* Tile Header */}
      <div className="flex items-center justify-between border-b border-line/60 p-4">
        <div className="min-w-0 pr-2">
          <h3 className="truncate text-xs font-black text-forest group-hover:text-forest-dark">
            {camera.name}
          </h3>
          <p className="truncate text-[10px] text-muted">
            {camera.area ?? 'Area Utama'} · {usecaseLabel ?? camera.useCase}
          </p>
        </div>

        {/* Status badges */}
        <div className="shrink-0 flex items-center gap-1.5">
          {isOnline ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500 camera-pulse" />
              {status?.state ? `${status.state} · ` : ''}
              {typeof status?.fps === 'number' ? `${status.fps.toFixed(1)} FPS` : 'Online'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
              <span className="size-1.5 rounded-full bg-zinc-400" />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Video / Still container (16:9) */}
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
        {!useStill && liveUrl ? (
          <WhepPlayer
            url={liveUrl}
            fallbackUrl={fallbackUrl}
            onFail={() => setPlayerFailed(true)}
            className="size-full object-contain"
          />
        ) : (
          <div className="relative flex size-full items-center justify-center">
            {!stillError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/v1/cameras/${camera.id}/frame?t=${frameTick}`}
                alt={`Snapshot Kamera ${camera.name}`}
                onError={() => setStillError(true)}
                onLoad={() => setStillError(false)}
                className="size-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center text-zinc-500">
                <Cctv className="mb-1 size-8 text-zinc-600" />
                <span className="text-[11px] font-bold">
                  {isOnline ? 'Menunggu Frame...' : 'Kamera Offline'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Hover overlay to expand */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-xs transition group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-forest/90 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
            <Maximize2 className="size-3.5 text-lime" />
            Buka Kamera
          </span>
        </div>
      </div>
    </div>
  );
}

export default LiveTile;
