import { Suspense } from 'react';
import { LivePage } from '@/features/live/LivePage';

export default function LiveRoute() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-xs font-bold text-muted">
          Memuat Live View...
        </div>
      }
    >
      <LivePage />
    </Suspense>
  );
}
