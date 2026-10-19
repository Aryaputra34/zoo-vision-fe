'use client';

import React from 'react';
import { Maximize2 } from 'lucide-react';
import type { CameraViewDto } from '@/api/generated/zooVisionAPI.schemas';
import type { CameraStatus } from '@/contract/web';
import { LiveVideo } from '@/video/LiveVideo';

export interface LiveTileProps {
  camera: CameraViewDto;
  status: CameraStatus | null | undefined;
  onClick?: () => void;
  usecaseLabel?: string;
}

export function LiveTile({ camera, status, onClick, usecaseLabel }: LiveTileProps) {
  // Preference: sub stream -> main stream -> 2s still frame
  const liveUrl = camera.liveUrls?.sub ?? camera.liveUrls?.main ?? null;
  const fallbackUrl = camera.liveUrls?.sub ? (camera.liveUrls?.main ?? null) : null;
  const isOnline = status !== undefined && status !== null;

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
        <LiveVideo
          cameraId={camera.id}
          alt={`Snapshot Kamera ${camera.name}`}
          url={liveUrl}
          fallbackUrl={fallbackUrl}
          emptyText={isOnline ? 'Menunggu Frame...' : 'Kamera Offline'}
        />

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
