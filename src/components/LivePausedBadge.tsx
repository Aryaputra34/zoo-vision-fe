"use client";

import { useStatus } from "@/live";

// The header's live pill: cameras online from the status room, or a warning when snapshots stop arriving.
export function LivePausedBadge() {
  const { cameras, paused } = useStatus();
  const all = Object.values(cameras);
  const online = all.filter((c) => c !== null).length;

  if (paused) {
    return (
      <div
        role="status"
        className="hidden md:flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
      >
        <span className="size-2 rounded-full bg-amber-500" />
        Data live terhenti
      </div>
    );
  }
  if (all.length === 0) return null;
  return (
    <div className="hidden md:flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-[11px] font-black text-forest dark:text-lime">
      <span className={`size-2 rounded-full ${online ? "bg-lime camera-pulse" : "bg-muted"}`} />
      <span>
        {online}/{all.length} Kamera Online
      </span>
    </div>
  );
}
