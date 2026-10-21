"use client";

import { useSyncExternalStore } from "react";
import { ServerCrash } from "lucide-react";
import { backendHealth } from "@/api/http";

// Shown after a request found the API unreachable or answering 503, until the next request succeeds.
export function BackendBanner() {
  const down = useSyncExternalStore(backendHealth.subscribe, backendHealth.down, () => false);
  if (!down) return null;
  return (
    <div
      role="alert"
      className="mb-5 flex items-center gap-2.5 rounded-xl border border-warn/40 bg-warn-bg px-4 py-2.5 text-[13px] font-semibold text-gold-ink"
    >
      <ServerCrash aria-hidden className="size-4 shrink-0" />
      Server tidak dapat dihubungi. Data mungkin tidak terbaru.
    </div>
  );
}
