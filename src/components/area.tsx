"use client";

import Link from "next/link";
import { Video } from "lucide-react";
import type { ReactNode } from "react";
import { useCamerasList } from "@/api/generated/cameras/cameras";
import type { CameraStatus } from "@/contract/web";
import { useStatus } from "@/live";

// Area pages share one layout: "Sekarang" (live state), "Hari ini" (totals and charts), "Riwayat".
export function AreaSection({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="mb-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-extrabold">{title}</h2>
        {note && <span className="text-xs text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function statusText(s: CameraStatus | null | undefined) {
  if (!s) return { label: "Offline", dot: "bg-off", ink: "text-[#4b5550]", warn: true };
  const fps = typeof s.fps === "number" ? ` · ${s.fps.toFixed(1)} fps` : "";
  if (s.state !== "RUNNING") return { label: `Terjeda${fps}`, dot: "bg-warn", ink: "text-gold-ink", warn: true };
  return { label: `Online${fps}`, dot: "bg-[#1e8e3e]", ink: "text-good", warn: false };
}

// The area's cameras as cards (live state from the status stream). `detail` adds a use-case line per camera.
export function AreaNow({
  useCases,
  detail,
  stacked,
}: {
  useCases: string[];
  stacked?: boolean;
  detail?: (status: CameraStatus | null | undefined) => ReactNode;
}) {
  const camerasQuery = useCamerasList();
  const { cameras: liveStatus } = useStatus();
  const cams = (camerasQuery.data ?? []).filter((c) => c.enabled && useCases.includes(c.useCase));

  if (camerasQuery.isLoading) return <p className="text-sm text-muted">Memuat kamera…</p>;
  if (cams.length === 0) return <p className="text-sm text-muted">Belum ada kamera aktif untuk area ini.</p>;

  return (
    <div className={stacked ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1" : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
      {cams.map((c) => {
        const s = liveStatus[c.id];
        const st = statusText(s);
        return (
          <Link
            key={c.id}
            href={`/live?cam=${encodeURIComponent(c.id)}`}
            className={`flex items-center gap-3 rounded-[14px] bg-surface p-3.5 transition-transform hover:-translate-y-0.5 ${
              st.warn ? "border border-[#f0d49a]" : "border border-line"
            }`}
          >
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-forest">
              <Video className="size-[18px]" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-bold text-ink">{c.name}</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${st.ink}`}>
                <span className={`size-1.5 rounded-full ${st.dot}`} />
                {st.label}
              </span>
              {detail && <span className="truncate text-xs text-muted">{detail(s)}</span>}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export const AREA_TITLE = "Area operasional";
export const AREA_SUBTITLE = "Satu tempat untuk keempat area. Pilih area di tab.";
