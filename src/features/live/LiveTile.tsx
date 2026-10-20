'use client';

import React from 'react';
import type { CameraViewDto } from '@/api/generated/zooVisionAPI.schemas';
import type { CameraStatus } from '@/contract/web';
import { LiveVideo } from '@/video/LiveVideo';

export interface LiveTileProps {
  camera: CameraViewDto;
  status: CameraStatus | null | undefined;
  onClick?: () => void;
  usecaseLabel?: string;
}

// on = engine running, lag = reporting but not RUNNING, off = not reporting.
export function liveHealth(status: CameraStatus | null | undefined): 'on' | 'lag' | 'off' {
  if (!status) return 'off';
  return status.state === 'RUNNING' ? 'on' : 'lag';
}

const CHIP = {
  on: { label: 'Online', cls: 'bg-good-bg text-good', dot: 'bg-[#1e8e3e] camera-pulse' },
  lag: { label: 'Terjeda', cls: 'bg-warn-bg text-gold-ink', dot: 'bg-warn' },
  off: { label: 'Offline', cls: 'bg-off-bg text-[#4b5550]', dot: 'bg-off' },
};

export function LiveTile({ camera, status, onClick, usecaseLabel }: LiveTileProps) {
  // Preference: sub stream -> main stream -> 2s still frame
  const liveUrl = camera.liveUrls?.sub ?? camera.liveUrls?.main ?? null;
  const fallbackUrl = camera.liveUrls?.sub ? (camera.liveUrls?.main ?? null) : null;
  const health = liveHealth(status);
  const chip = CHIP[health];
  const configError = status?.configError;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-label={`Buka ${camera.name}`}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(12,53,32,0.16)] focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none ${
        configError ? 'border-2 border-[#e5483d]' : health === 'off' ? 'border border-[#cfc9b8]' : 'border border-line'
      }`}
    >
      {/* Video / still (16:9) */}
      <div className="relative aspect-video w-full overflow-hidden bg-[#1b2822]">
        <LiveVideo
          cameraId={camera.id}
          alt={`Snapshot Kamera ${camera.name}`}
          url={liveUrl}
          fallbackUrl={fallbackUrl}
          emptyText={health === 'off' ? 'Kamera offline' : 'Menunggu frame…'}
        />
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-extrabold ${chip.cls}`}>
          <span aria-hidden className={`size-1.5 rounded-full ${chip.dot}`} />
          {chip.label}
          {status && typeof status.fps === 'number' && (
            <span className="font-mono font-semibold">· {status.fps.toFixed(1)} fps</span>
          )}
        </span>
        {configError && (
          <span title={configError} className="absolute top-2 right-2 rounded-full bg-crit px-2.5 py-[3px] text-[11px] font-extrabold text-white">
            Konfigurasi ditolak
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold text-ink">{camera.name}</span>
          <span className="truncate text-xs text-muted">{camera.area ?? 'Area Utama'}</span>
        </span>
        <span className="shrink-0 truncate rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold whitespace-nowrap text-ink">
          {usecaseLabel ?? camera.useCase}
        </span>
      </div>
    </div>
  );
}

export default LiveTile;
