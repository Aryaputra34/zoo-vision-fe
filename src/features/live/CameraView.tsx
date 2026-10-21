'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bug, ChevronLeft, ChevronRight, Settings2, Sliders } from 'lucide-react';
import type { CameraViewDto } from '@/api/generated/zooVisionAPI.schemas';
import type { CameraStatus } from '@/contract/web';
import { useCameraConfigActive } from '@/api/generated/camera-config/camera-config';
import { useEventsList } from '@/api/generated/events/events';
import { useMe } from '@/auth/AuthProvider';
import { SeverityBadge } from '@/components/ui';
import { LiveVideo } from '@/video/LiveVideo';
import { BoxOverlay } from '@/video/BoxOverlay';
import { StreamPanel } from '@/features/cameras/StreamPanel';
import { fmtLocalTime, localDayRange, todayLocal } from '@/lib/time';
import { liveHealth } from './LiveTile';

export interface CameraViewProps {
  camera: CameraViewDto;
  status: CameraStatus | null | undefined;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  usecaseLabel?: string;
}

const HEALTH = {
  on: { label: 'Online', cls: 'text-good', dot: 'bg-[#1e8e3e] camera-pulse' },
  lag: { label: 'Terjeda', cls: 'text-gold-ink', dot: 'bg-warn' },
  off: { label: 'Offline', cls: 'text-[#4b5550]', dot: 'bg-off' },
};

function ago(ms: number | null | undefined) {
  if (!ms) return '—';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return `${s.toFixed(1).replace('.', ',')} dtk lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  return `${Math.floor(s / 3600)} jam lalu`;
}

const fmtValue = (v: unknown) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));

// "Mode fokus": one camera large with its live state, engine state and today's events.
export function CameraView({ camera, status, onClose, onPrev, onNext, usecaseLabel }: CameraViewProps) {
  const { me } = useMe();
  const isSuperAdmin = me?.role === 'SUPERADMIN';
  const isManagerOrAbove = me?.role === 'SUPERADMIN' || me?.role === 'MANAGER';

  const [isDebug, setIsDebug] = useState(false);
  const [extraDelayMs, setExtraDelayMs] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const hasBoth = Boolean(camera.liveUrls?.main && camera.liveUrls?.sub);
  const [stream, setStream] = useState<'main' | 'sub'>('main');

  const activeConfig = useCameraConfigActive(camera.id, { query: { enabled: !!camera.id } });
  const events = useEventsList({ ...localDayRange(todayLocal()), cameraIds: camera.id, limit: 5 });

  // Preference when opened: main stream -> sub stream -> 2s still frame
  const main = camera.liveUrls?.main ?? null;
  const sub = camera.liveUrls?.sub ?? null;
  const primaryUrl = hasBoth && stream === 'sub' ? sub : (main ?? sub);
  const fallbackUrl = hasBoth ? (stream === 'sub' ? main : sub) : null;

  const health = liveHealth(status);
  const h = HEALTH[health];
  const applied = status?.appliedVersion ?? null;
  const liveEntries = Object.entries(status?.live ?? {}).filter(([, v]) => v !== null && typeof v !== 'object');

  const iconBtn =
    'grid size-10 cursor-pointer place-items-center rounded-[10px] border border-[#cfc9b8] bg-surface text-ink hover:bg-surface-2 disabled:cursor-default disabled:opacity-40';

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-fit cursor-pointer items-center gap-1 text-[13px] font-bold text-forest hover:underline"
          >
            <ArrowLeft aria-hidden className="size-3.5" /> Semua kamera
          </button>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-[26px] font-extrabold tracking-tight">{camera.name}</h1>
            <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${h.cls}`}>
              <span aria-hidden className={`size-2 rounded-full ${h.dot}`} />
              {h.label}
              {status && typeof status.fps === 'number' ? ` · ${status.fps.toFixed(1)} fps` : ''}
            </span>
          </div>
          <span className="text-[13px] text-muted">
            <span className="font-mono">{camera.id}</span> · {camera.area ?? 'Utama'} · {usecaseLabel ?? camera.useCase}
            {camera.activeVersion != null ? ` · config v${camera.activeVersion}` : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Kamera sebelumnya" className={iconBtn}>
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button type="button" onClick={onNext} disabled={!onNext} aria-label="Kamera berikutnya" className={iconBtn}>
            <ChevronRight aria-hidden className="size-4" />
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              aria-pressed={isDebug}
              onClick={() => setIsDebug(!isDebug)}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-bold ${
                isDebug ? 'border-forest bg-forest text-white' : 'border-[#cfc9b8] bg-surface text-ink hover:bg-surface-2'
              }`}
            >
              <Bug aria-hidden className="size-3.5" /> Debug frame
            </button>
          )}
          {isManagerOrAbove && (
            <Link
              href={`/config/cameras/${encodeURIComponent(camera.id)}/zones`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-forest px-3.5 text-[13px] font-bold text-white hover:bg-accent-hover"
            >
              <Settings2 aria-hidden className="size-3.5" /> Atur zona kamera
            </Link>
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Video */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-[#1b2822]">
            {isDebug ? (
              // Debug view: unmounts player, displays direct server annotated MJPEG debug frames
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/media/debug/${camera.id}`} alt={`Debug Stream ${camera.name}`} className="size-full object-contain" />
            ) : (
              <LiveVideo
                key={primaryUrl ?? 'none'}
                cameraId={camera.id}
                alt={`Snapshot Kamera ${camera.name}`}
                url={primaryUrl}
                fallbackUrl={fallbackUrl}
                emptyText={health === 'off' ? 'Kamera offline' : 'Menunggu frame…'}
                overlay={
                  showOverlay
                    ? (video, reader) => (
                        <BoxOverlay
                          video={video}
                          cameraId={camera.id}
                          settings={activeConfig.data?.settings}
                          extraDelayMs={extraDelayMs}
                          reader={reader}
                        />
                      )
                    : undefined
                }
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
            {hasBoth && !isDebug && (
              <div role="group" aria-label="Stream" className="flex gap-0.5 rounded-[10px] border border-line bg-surface p-[3px]">
                {(['main', 'sub'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={stream === s}
                    onClick={() => setStream(s)}
                    className={`min-h-8 cursor-pointer rounded-lg px-3 ${stream === s ? 'bg-lime font-bold text-forest-dark' : 'font-semibold hover:bg-surface-2'}`}
                  >
                    {s === 'main' ? 'Main' : 'Sub'}
                  </button>
                ))}
              </div>
            )}
            {!isDebug && (
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} className="size-4 accent-forest" />
                Kotak deteksi &amp; zona
              </label>
            )}
            <span className="text-xs text-muted">Jika WebRTC gagal, beralih ke frame diam tiap 2 dtk</span>
          </div>

          {/* SUPERADMIN: Delay Slider */}
          {isSuperAdmin && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-3.5">
              <div className="flex items-center gap-2">
                <Sliders aria-hidden className="size-4 text-forest" />
                <div>
                  <div className="text-[13px] font-bold text-ink">Kompensasi delay kotak deteksi</div>
                  <div className="text-xs text-muted">Menyelaraskan kotak AI dengan video (−500 ms s/d +1000 ms)</div>
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
                  aria-label="Kompensasi delay"
                  className="h-2 w-40 cursor-pointer accent-forest"
                />
                <span className="w-16 text-right font-mono text-xs font-bold text-ink">
                  {extraDelayMs >= 0 ? `+${extraDelayMs}` : extraDelayMs} ms
                </span>
                {extraDelayMs !== 0 && (
                  <button type="button" onClick={() => setExtraDelayMs(0)} className="cursor-pointer text-xs font-semibold text-muted underline hover:text-ink">
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside aria-label="Info kamera" className="flex flex-col gap-3.5">
          <section className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="mb-2.5 text-[15px] font-extrabold">Sekarang</h2>
            {!status ? (
              <p className="text-sm text-muted">Kamera tidak melapor.</p>
            ) : liveEntries.length === 0 ? (
              <p className="text-sm text-muted">Belum ada keadaan live dari engine.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {liveEntries.map(([k, v]) => (
                  <div key={k} className="flex min-w-0 flex-col rounded-[10px] bg-bg p-2.5">
                    <span className="truncate text-[11px] font-bold text-muted">{k}</span>
                    <span className="truncate text-lg font-extrabold">{fmtValue(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-4 text-[13px]">
            <h2 className="mb-2.5 text-[15px] font-extrabold">Engine</h2>
            <dl className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">State</dt>
                <dd className="font-mono text-xs font-semibold">{status?.state ?? 'OFFLINE'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Frame terakhir</dt>
                <dd className="font-semibold">{ago(status?.lastFrameAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Konfigurasi</dt>
                <dd className="text-right font-semibold">
                  {applied == null
                    ? '—'
                    : `v${applied} · ${status?.configError ? 'ditolak' : applied === camera.activeVersion ? 'diterapkan' : 'menunggu engine'}`}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Restart</dt>
                <dd className="font-semibold">{status?.restarts ?? '—'}</dd>
              </div>
            </dl>
            {status?.configError && (
              <p className="mt-2.5 rounded-[10px] bg-crit-bg px-3 py-2 text-xs font-semibold text-crit-ink">{status.configError}</p>
            )}
          </section>

          {/* MANAGER & SUPERADMIN: stream info */}
          {isManagerOrAbove && <StreamPanel cameraId={camera.id} />}

          <section className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold">Kejadian kamera ini</h2>
              <Link href="/events" className="text-[13px] font-bold text-forest hover:underline">
                Semua →
              </Link>
            </div>
            {events.isLoading ? (
              <p className="text-sm text-muted">Memuat…</p>
            ) : (events.data?.rows ?? []).length === 0 ? (
              <p className="text-sm text-muted">Belum ada kejadian hari ini.</p>
            ) : (
              <ul className="-mx-4">
                {(events.data?.rows ?? []).map((e) => (
                  <li key={e.id} className="flex items-center gap-2.5 border-t border-line-soft px-4 py-2 text-[13px]">
                    <span className="w-11 shrink-0 font-mono text-xs text-muted">{fmtLocalTime(e.time).slice(0, 5)}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold capitalize">{e.type.replace(/_/g, ' ')}</span>
                    <SeverityBadge severity={e.severity} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default CameraView;
