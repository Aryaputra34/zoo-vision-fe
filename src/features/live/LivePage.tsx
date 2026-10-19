'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useCamerasList } from '@/api/generated/cameras/cameras';
import { useUsecasesList } from '@/api/generated/usecases/usecases';
import { useStatus } from '@/live';
import { PageHeader, Card } from '@/components/ui';
import { LiveTile } from './LiveTile';
import { CameraView } from './CameraView';

export function LivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCamId = searchParams.get('cam');

  const camerasQuery = useCamerasList();
  const usecasesQuery = useUsecasesList();
  const { cameras: liveStatus } = useStatus();

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');

  const cameras = (camerasQuery.data ?? []).filter((c) => c.enabled);
  const areas = Array.from(new Set(cameras.map((c) => c.area).filter(Boolean))) as string[];
  const usecasesMap = new Map((usecasesQuery.data ?? []).map((u) => [u.id, u.label]));

  const filteredCameras = cameras.filter((cam) => {
    const matchSearch =
      cam.name.toLowerCase().includes(search.toLowerCase()) ||
      cam.id.toLowerCase().includes(search.toLowerCase()) ||
      (cam.area ?? '').toLowerCase().includes(search.toLowerCase());
    const matchArea = selectedArea === 'ALL' || cam.area === selectedArea;
    return matchSearch && matchArea;
  });

  const activeCamera = activeCamId ? cameras.find((c) => c.id === activeCamId) : null;

  return (
    <>
      <PageHeader
        title="Live kamera"
        subtitle="Klik kamera untuk membuka tayangan besar dengan kotak deteksi AI."
      />

      {/* Search and area filter */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, ID, atau area kamera"
            aria-label="Cari kamera"
            className="h-10 w-full rounded-[10px] border border-[#cfc9b8] bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
          />
        </div>
        <div role="group" aria-label="Filter area" className="flex flex-wrap gap-2">
          {[{ id: 'ALL', label: 'Semua area', count: cameras.length }, ...areas.map((a) => ({ id: a, label: a, count: cameras.filter((c) => c.area === a).length }))].map((opt) => {
            const on = selectedArea === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelectedArea(opt.id)}
                className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                  on ? 'border-forest bg-forest text-white' : 'border-[#cfc9b8] bg-surface text-ink hover:bg-surface-2'
                }`}
              >
                {opt.label}
                <span className={`text-xs font-extrabold ${on ? 'text-lime' : 'text-muted'}`}>{opt.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Camera Grid */}
      {filteredCameras.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {filteredCameras.map((cam) => (
            <LiveTile
              key={cam.id}
              camera={cam}
              status={liveStatus[cam.id]}
              usecaseLabel={usecasesMap.get(cam.useCase)}
              onClick={() => router.push(`/live?cam=${encodeURIComponent(cam.id)}`)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <div className="py-16 text-center text-sm font-semibold text-muted">
            {camerasQuery.isLoading
              ? 'Memuat daftar kamera…'
              : 'Tidak ada kamera aktif yang cocok dengan pencarian.'}
          </div>
        </Card>
      )}

      {/* Camera Full View Modal */}
      {activeCamera && (
        <CameraView
          key={activeCamera.id}
          camera={activeCamera}
          status={liveStatus[activeCamera.id]}
          usecaseLabel={usecasesMap.get(activeCamera.useCase)}
          onClose={() => router.push('/live')}
        />
      )}
    </>
  );
}

export default LivePage;
