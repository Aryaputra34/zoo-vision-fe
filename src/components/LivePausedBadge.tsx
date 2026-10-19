"use client";

import { useStatus } from "@/live";

// The live pill: cameras online from the status room, or a warning when snapshots stop arriving.
export function LivePausedBadge() {
  const { cameras, paused } = useStatus();
  const all = Object.values(cameras);
  const online = all.filter((c) => c !== null).length;

  if (paused) {
    return (
      <div
        role="status"
        className="inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn-bg px-3 py-1 text-xs font-bold text-gold-ink"
      >
        <span className="size-2 rounded-full bg-warn" />
        Data live terhenti
      </div>
    );
  }
  if (all.length === 0) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-good/20 bg-good-bg px-3 py-1 text-xs font-bold text-good">
      <span className={`size-2 rounded-full ${online ? "bg-good camera-pulse" : "bg-off"}`} />
      <span>
        {online}/{all.length} kamera online
      </span>
    </div>
  );
}
