"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSiteSettingsGet } from "@/api/generated/site-settings/site-settings";
import { useMe } from "@/auth/AuthProvider";
import { setSiteTimeZone } from "@/lib/time";

// Holds the pages back until the site time zone is known, so nothing formats with the wrong zone. A later answer with
// another zone (a SUPERADMIN saved one) is applied and every query refetched, so the open tab re-renders in it.
export function SiteZoneGate({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const queryClient = useQueryClient();
  const onLogin = usePathname() === "/login";
  const waiting = !!me && !onLogin;

  const { data, isPending } = useSiteSettingsGet({ query: { enabled: waiting } });
  const tz = data?.timeZone;
  if (tz) setSiteTimeZone(tz);

  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (!tz) return;
    if (applied.current !== null && applied.current !== tz) void queryClient.invalidateQueries();
    applied.current = tz;
  }, [tz, queryClient]);

  if (waiting && isPending) {
    return <p className="bg-bg py-16 text-center text-sm font-semibold text-muted">Memuat…</p>;
  }
  return <>{children}</>;
}
