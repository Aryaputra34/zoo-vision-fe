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
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(19,36,26,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(12,53,32,0.18)]"
    >
      {/* Tile Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0 pr-2">
          <h3 className="truncate text-sm font-extrabold text-ink">
            {camera.name}
          </h3>
          <p className="truncate text-xs text-muted">
            {camera.area ?? 'Area Utama'} · {usecaseLabel ?? camera.useCase}
          </p>
        </div>

        {/* Status badges */}
        <div className="shrink-0 flex items-center gap-1.5">
          {isOnline ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-good-bg px-2 py-0.5 font-mono text-[11px] font-semibold text-good">
              <span className="size-1.5 rounded-full bg-good camera-pulse" />
              {status?.state ? `${status.state} · ` : ''}
              {typeof status?.fps === 'number' ? `${status.fps.toFixed(1)} FPS` : 'Online'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-off-bg px-2 py-0.5 text-[11px] font-bold text-[#4b5550]">
              <span className="size-1.5 rounded-full bg-off" />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Video / Still container (16:9) */}
      <div className="relative aspect-video w-full overflow-hidden bg-[#141b17]">
        <LiveVideo
          cameraId={camera.id}
          alt={`Snapshot Kamera ${camera.name}`}
          url={liveUrl}
          fallbackUrl={fallbackUrl}
          emptyText={isOnline ? 'Menunggu frame…' : 'Kamera offline'}
        />

        {/* Hover overlay to expand */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-xs transition group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-forest px-3 py-1.5 text-[13px] font-bold text-white shadow-lg">
            <Maximize2 className="size-3.5 text-lime" />
            Buka Kamera
          </span>
        </div>
      </div>
    </div>
  );
}

export default LiveTile;
