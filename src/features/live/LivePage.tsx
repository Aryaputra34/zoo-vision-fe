'use client';

import React, { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Maximize, Search } from 'lucide-react';
import { useCamerasList } from '@/api/generated/cameras/cameras';
import { useUsecasesList } from '@/api/generated/usecases/usecases';
import { useStatus } from '@/live';
import type { CameraStatus } from '@/contract/web';
import { LiveTile, liveHealth } from './LiveTile';
import { CameraView } from './CameraView';

// Grid density of the tile wall (view preference only, nothing is stored).
const LAYOUTS = [
  { id: '2', label: '2×2', cls: 'grid-cols-1 sm:grid-cols-2' },
  { id: '3', label: '3×3', cls: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' },
  { id: '4', label: '4×4', cls: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' },
] as const;
type LayoutId = (typeof LAYOUTS)[number]['id'];

const DOT: Record<ReturnType<typeof liveHealth>, string> = {
  on: 'bg-[#1e8e3e]',
  lag: 'bg-warn',
  off: 'bg-off',
};

const isProblem = (s: CameraStatus | null | undefined) => liveHealth(s) !== 'on' || Boolean(s?.configError);

export function LivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCamId = searchParams.get('cam');

  const camerasQuery = useCamerasList();
  const usecasesQuery = useUsecasesList();
  const { cameras: liveStatus } = useStatus();

  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [layout, setLayout] = useState<LayoutId>('3');
  const wallRef = useRef<HTMLElement>(null);

  const cameras = (camerasQuery.data ?? []).filter((c) => c.enabled);
  const areas = Array.from(new Set(cameras.map((c) => c.area).filter(Boolean))) as string[];
  const usecasesMap = new Map((usecasesQuery.data ?? []).map((u) => [u.id, u.label]));

  const q = search.trim().toLowerCase();
  const filteredCameras = cameras.filter((cam) => {
    const matchSearch =
      !q ||
      cam.name.toLowerCase().includes(q) ||
      cam.id.toLowerCase().includes(q) ||
      (cam.area ?? '').toLowerCase().includes(q);
    const matchArea = selectedArea === 'ALL' || cam.area === selectedArea;
    return matchSearch && matchArea && (!problemsOnly || isProblem(liveStatus[cam.id]));
  });

  // Camera list on the left, grouped by area (same filter as the wall).
  const groups = Array.from(new Set(filteredCameras.map((c) => c.area || 'Lainnya'))).map((area) => ({
    area,
    cams: filteredCameras.filter((c) => (c.area || 'Lainnya') === area),
  }));

  const online = cameras.filter((c) => liveStatus[c.id]).length;
  const activeCamera = activeCamId ? cameras.find((c) => c.id === activeCamId) : null;
  const open = (id: string) => router.push(`/live?cam=${encodeURIComponent(id)}`);

  const goFullscreen = () => {
    const el = wallRef.current;
    if (el && document.fullscreenEnabled) void el.requestFullscreen().catch(() => {});
  };

  if (activeCamera) {
    const i = cameras.findIndex((c) => c.id === activeCamera.id);
    const step = (d: number) => open(cameras[(i + d + cameras.length) % cameras.length].id);
    return (
      <div className="-mx-4 -my-6 sm:-mx-6 2xl:-mx-8">
        <CameraView
          key={activeCamera.id}
          camera={activeCamera}
          status={liveStatus[activeCamera.id]}
          usecaseLabel={usecasesMap.get(activeCamera.useCase)}
          onPrev={cameras.length > 1 ? () => step(-1) : undefined}
          onNext={cameras.length > 1 ? () => step(1) : undefined}
          onClose={() => router.push('/live')}
        />
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-56px)] flex-col sm:-mx-6 lg:flex-row 2xl:-mx-8">
      {/* Camera list */}
      <aside aria-label="Daftar kamera" className="flex shrink-0 flex-col border-line bg-surface max-lg:border-b lg:w-[288px] lg:border-r">
        <div className="flex flex-col gap-2.5 border-b border-line-soft p-4">
          <div className="flex h-10 items-center gap-2 rounded-[10px] border border-[#cfc9b8] px-2.5 focus-within:border-forest focus-within:ring-2 focus-within:ring-lime/40">
            <Search aria-hidden className="size-4 shrink-0 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kamera"
              aria-label="Cari kamera"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted"
            />
          </div>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            aria-label="Filter area"
            className="h-10 cursor-pointer rounded-[10px] border border-[#cfc9b8] bg-surface px-2.5 text-[13px] font-semibold text-ink focus:border-forest focus:ring-2 focus:ring-lime/40 focus:outline-none"
          >
            <option value="ALL">Semua area ({cameras.length})</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a} ({cameras.filter((c) => c.area === a).length})
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
            <input
              type="checkbox"
              checked={problemsOnly}
              onChange={(e) => setProblemsOnly(e.target.checked)}
              className="size-4 accent-forest"
            />
            Tampilkan yang bermasalah saja
          </label>
        </div>
        <nav aria-label="Kamera per area" className="max-h-64 overflow-y-auto lg:max-h-none">
          {groups.map((g) => (
            <div key={g.area} className="flex flex-col py-2">
              <span className="px-4 py-1 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{g.area}</span>
              {g.cams.map((c) => {
                const s = liveStatus[c.id];
                const on = c.id === activeCamId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => open(c.id)}
                    aria-current={on ? 'true' : undefined}
                    className={`flex cursor-pointer items-center gap-2.5 border-l-[3px] px-4 py-2 text-left transition-colors ${
                      on ? 'border-lime bg-[#eaf3dc]' : 'border-transparent hover:bg-surface-2'
                    }`}
                  >
                    <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[liveHealth(s)]}`} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-semibold">{c.name}</span>
                      <span className="truncate text-xs text-muted">{usecasesMap.get(c.useCase) ?? c.useCase}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {s && typeof s.fps === 'number' ? `${s.fps.toFixed(1)} fps` : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {groups.length === 0 && !camerasQuery.isLoading && (
            <p className="px-4 py-6 text-sm text-muted">Tidak ada kamera yang cocok.</p>
          )}
        </nav>
      </aside>

      {/* Tile wall */}
      <section ref={wallRef} aria-label="Tayangan kamera" className="flex min-w-0 flex-1 flex-col gap-4 bg-bg px-4 pt-5 pb-8 sm:px-6">
        <div className="hero-band flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[18px] px-6 py-[22px] text-white shadow-[0_14px_32px_rgba(12,53,32,0.18)]">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-extrabold tracking-tight">Live kamera</h1>
            <span className="text-[13px] text-[#cfe3d4]">
              {camerasQuery.isLoading
                ? 'Memuat kamera…'
                : `${cameras.length} kamera aktif · ${online} online · klik kamera untuk mode fokus`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Tata letak" className="flex gap-0.5 rounded-[10px] border border-line bg-surface p-[3px]">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={layout === l.id}
                  onClick={() => setLayout(l.id)}
                  className={`min-h-[34px] cursor-pointer rounded-lg px-[11px] text-[13px] transition-colors ${
                    layout === l.id ? 'bg-lime font-bold text-forest-dark' : 'font-semibold text-ink hover:bg-surface-2'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={goFullscreen}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#cfc9b8] bg-surface px-3 text-[13px] font-bold text-ink hover:bg-surface-2"
            >
              <Maximize aria-hidden className="size-3.5" /> Layar penuh
            </button>
          </div>
        </div>

        {filteredCameras.length > 0 ? (
          <div className={`grid gap-3 ${LAYOUTS.find((l) => l.id === layout)!.cls}`}>
            {filteredCameras.map((cam) => (
              <LiveTile
                key={cam.id}
                camera={cam}
                status={liveStatus[cam.id]}
                usecaseLabel={usecasesMap.get(cam.useCase)}
                onClick={() => open(cam.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface py-16 text-center text-sm font-semibold text-muted">
            {camerasQuery.isLoading
              ? 'Memuat daftar kamera…'
              : problemsOnly
                ? 'Tidak ada kamera bermasalah saat ini.'
                : 'Tidak ada kamera aktif yang cocok dengan pencarian.'}
          </div>
        )}
      </section>

    </div>
  );
}

export default LivePage;
