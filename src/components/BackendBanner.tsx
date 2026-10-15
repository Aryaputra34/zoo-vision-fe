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
      className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-400/50 bg-amber-50 px-4 py-2.5 text-xs font-extrabold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
    >
      <ServerCrash aria-hidden className="size-4 shrink-0" />
      Server tidak dapat dihubungi. Data mungkin tidak terbaru.
    </div>
  );
}
