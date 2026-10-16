'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, Search } from 'lucide-react';
import { useCamerasList } from '@/api/generated/cameras/cameras';
import { useUsecasesList } from '@/api/generated/usecases/usecases';
import { useStatus } from '@/live';
import { PageHeader, Card } from '@/components/ui';
import { LivePausedBadge } from '@/components/LivePausedBadge';
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
        tag="Taman Safari Bogor · Sensor Hub"
        title="Pemantauan Kamera AI Langsung (Live View)"
        subtitle="Grid feed visual sensor kamera CCTV aktif dengan pemutaran WebRTC WHEP dan deteksi objek AI real-time"
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
          <div className="py-16 text-center text-xs font-bold text-muted">
            {camerasQuery.isLoading
              ? 'Memuat daftar kamera CCTV...'
              : 'Tidak ada kamera aktif yang cocok dengan kriteria pencarian.'}
          </div>
        </Card>
      )}

      {/* Camera Full View Modal */}
      {activeCamera && (
        <CameraView
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
