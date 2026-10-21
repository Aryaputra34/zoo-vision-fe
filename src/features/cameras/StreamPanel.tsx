'use client';

import React from 'react';
import { AlertTriangle, Film, HardDrive, Radio, Video } from 'lucide-react';
import { useCamerasStreamInfo } from '@/api/generated/cameras/cameras';
import { ApiError } from '@/api/http';
import { useMe } from '@/auth/AuthProvider';

export interface StreamPanelProps {
  cameraId: string;
}

export function StreamPanel({ cameraId }: StreamPanelProps) {
  const { me } = useMe();
  const isManagerOrAbove = me?.role === 'MANAGER' || me?.role === 'SUPERADMIN';

  const { data, error, isLoading } = useCamerasStreamInfo(cameraId, {
    query: {
      enabled: isManagerOrAbove && !!cameraId,
      refetchInterval: 5000,
    },
  });

  // Renders nothing for a USER
  if (!isManagerOrAbove) {
    return null;
  }

  const is503 = error instanceof ApiError && error.statusCode === 503;

  if (is503) {
    return (
      <div className="rounded-2xl border border-warn/25 bg-warn-bg p-4 text-xs font-semibold text-gold-ink">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-gold-ink" />
          <span>MediaMTX tidak tersedia</span>
        </div>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4 text-xs text-muted">
        Memuat informasi stream...
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const diskInfo = data.disk;
  const freeGB = diskInfo ? (diskInfo.freeBytes / 1e9).toFixed(1) : null;
  const totalGB = diskInfo ? (diskInfo.totalBytes / 1e9).toFixed(1) : null;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-xs shadow-xs">
      <div className="mb-3 flex items-center justify-between border-b border-line/60 pb-2">
        <div className="flex items-center gap-2 font-bold text-ink">
          <Video className="size-4 text-forest" />
          <span>Informasi Stream & Rekaman MediaMTX</span>
        </div>
        <span className="text-[10px] text-muted">Diperbarui setiap 5 dtk</span>
      </div>

      {/* Stream paths */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.paths.map((p) => {
          const bitrateMbit =
            p.bitrateBps !== null
              ? `${(p.bitrateBps / 1_000_000).toFixed(2)} Mbit/s`
              : 'mengukur…';

          const estGB =
            p.estimatedBytes !== null
              ? `${(p.estimatedBytes / 1e9).toFixed(1)} GB`
              : null;

          return (
            <div
              key={p.name}
              className="rounded-xl border border-line/80 bg-surface-2 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-ink">
                  <Radio className="size-3.5 text-forest" />
                  <span>Stream {p.stream} ({p.name})</span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    p.ready
                      ? 'border border-good/25 bg-good-bg text-good'
                      : 'border border-line bg-off-bg text-muted'
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      p.ready ? 'bg-good' : 'bg-off'
                    }`}
                  />
                  {p.ready ? 'Terhubung' : 'Tidak terhubung'}
                </span>
              </div>

              {/* Codecs & Warning */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-2">
                <span>Codec:</span>
                <span className="font-mono font-bold text-ink">
                  {p.codecs.length > 0 ? p.codecs.join(', ') : '–'}
                </span>

                {p.codecWarning === 'H265_BROWSER' && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-warn/25 bg-warn-bg px-1.5 py-0.5 text-[10px] font-bold text-gold-ink">
                    <AlertTriangle className="size-3 text-gold-ink" />
                    H.265: browser mungkin tidak bisa memutar
                  </span>
                )}
              </div>

              {/* Bitrate */}
              <div className="mt-1.5 text-[11px] text-ink-2">
                <span>Bitrate: </span>
                <span className="font-mono font-bold text-ink">{bitrateMbit}</span>
              </div>

              {/* Recorded path storage estimate */}
              {p.recorded && (
                <div className="mt-2 border-t border-line/60 pt-2 text-[11px] text-forest">
                  <span className="font-bold">Alur Direkam:</span>{' '}
                  <span>Estimasi storage: </span>
                  <strong className="font-mono text-ink">
                    {estGB ?? 'menghitung…'}
                  </strong>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Kept evidence clips of this camera */}
      <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-[11px] text-muted">
        <div className="flex items-center gap-1.5">
          <Film className="size-3.5 text-forest" />
          <span>Bukti tersimpan:</span>
        </div>
        <span className="font-mono font-bold text-ink">
          {data.evidenceCount} klip, {(data.evidenceBytes / 1e9).toFixed(1)} GB
        </span>
      </div>

      {/* Disk info */}
      {diskInfo && (
        <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <HardDrive className="size-3.5 text-forest" />
            <span>Kapasitas Disk Rekaman:</span>
          </div>
          <span className="font-mono font-bold text-ink">
            {freeGB} GB bebas dari {totalGB} GB
          </span>
        </div>
      )}
    </div>
  );
}

export default StreamPanel;
