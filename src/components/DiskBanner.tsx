"use client";

import { useState } from "react";
import { HardDrive, X } from "lucide-react";
import type { DiskWarning } from "@/contract/web";
import { useMe } from "@/auth/AuthProvider";
import { roleAtLeast } from "@/auth/roles";
import { useDiskWarnings } from "@/live";

const LINE = {
  warning: "border-warn/40 bg-warn-bg text-gold-ink",
  critical: "border-crit/30 bg-crit-bg text-crit-ink",
} as const;

// Managers only (the socket only sends disk.warning to them). The latest message per path wins; one dismiss hides
// the whole banner until the next message arrives.
export function DiskBanner() {
  const { me } = useMe();
  const [byPath, setByPath] = useState<Record<string, DiskWarning>>({});
  const [dismissed, setDismissed] = useState(false);

  useDiskWarnings((w) => {
    setByPath((prev) => ({ ...prev, [w.path]: w }));
    setDismissed(false);
  });

  const lines = Object.values(byPath).sort((a, b) => a.path.localeCompare(b.path));
  if (!me || !roleAtLeast(me.role, "MANAGER") || dismissed || lines.length === 0) return null;

  return (
    <div role="alert" className="mb-5 flex items-start gap-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        {lines.map((w) => (
          <div
            key={w.path}
            className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[13px] font-semibold ${LINE[w.severity]}`}
          >
            <HardDrive aria-hidden className="size-4 shrink-0" />
            <span>
              {w.severity === "critical" ? "Kritis: " : ""}Disk {w.path} terisi {w.usedPercent}% (sisa{" "}
              {(w.freeBytes / 1e9).toFixed(1)} GB)
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Tutup peringatan disk"
        className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-surface text-forest hover:bg-lime/20"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
