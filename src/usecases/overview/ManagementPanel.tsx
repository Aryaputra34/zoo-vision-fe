"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSystemLogAudit } from "@/api/generated/system-log/system-log";
import type { CameraViewDto } from "@/api/generated/zooVisionAPI.schemas";
import type { CameraStatus } from "@/contract/web";
import { Card } from "@/components/ui";
import { fmtLocalTime } from "@/lib/time";

// MANAGER and up: configuration state of the cameras and today's changes. Only rendered for those roles, so
// the audit request (MANAGER minimum) is never sent for a USER.
export function ManagementPanel({
  cameras,
  liveStatus,
  day,
  isToday,
}: {
  cameras: CameraViewDto[];
  liveStatus: Record<string, CameraStatus | null>;
  day: { from: string; to: string };
  isToday: boolean;
}) {
  const auditQuery = useSystemLogAudit({ ...day, limit: 5 });
  const audit = auditQuery.data?.rows ?? [];

  // Saved → applied: the engine reports the version it runs (appliedVersion) and any rejection (configError).
  const enabled = cameras.filter((c) => c.enabled);
  const reporting = enabled.filter((c) => liveStatus[c.id]);
  const rejected = reporting.filter((c) => liveStatus[c.id]?.configError);
  const pending = reporting.filter(
    (c) => !liveStatus[c.id]?.configError && liveStatus[c.id]?.appliedVersion !== c.activeVersion,
  );
  const applied = reporting.length - rejected.length - pending.length;
  const unknown = enabled.length - reporting.length;
  const total = Math.max(enabled.length, 1);

  const segments = [
    { n: applied, label: "diterapkan", cls: "bg-good" },
    { n: pending.length, label: "menunggu engine", cls: "bg-s4" },
    { n: rejected.length, label: "ditolak", cls: "bg-crit" },
    { n: unknown, label: "tidak melapor", cls: "bg-surface-3" },
  ].filter((s) => s.n > 0);

  const problems = [
    ...rejected.map((c) => ({ cam: c, tag: "Ditolak engine", cls: "bg-crit-bg text-crit-ink", note: liveStatus[c.id]?.configError ?? "" })),
    ...pending.map((c) => ({
      cam: c,
      tag: "Menunggu engine",
      cls: "bg-info-bg text-info",
      note: `Tersimpan v${c.activeVersion}, engine menjalankan v${liveStatus[c.id]?.appliedVersion ?? "—"}`,
    })),
  ];

  return (
    <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
      <Card
        title="Konfigurasi kamera"
        subtitle={isToday ? "Status Tersimpan → Diterapkan dari laporan engine" : "Status saat ini (tidak tergantung tanggal)"}
        actions={
          <Link href="/config/cameras" className="inline-flex items-center gap-1 text-[13px] font-bold text-forest hover:underline">
            Semua kamera <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        }
      >
        <div aria-hidden className="mb-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {segments.map((s) => (
            <span key={s.label} className={s.cls} style={{ flex: s.n / total }} />
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-2">
          {segments.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-[3px] ${s.cls}`} />
              {s.n} {s.label}
            </span>
          ))}
        </div>
        {problems.length === 0 ? (
          <p className="text-sm text-muted">Semua kamera yang melapor menjalankan konfigurasi terbaru.</p>
        ) : (
          <div className="-mx-5 sm:-mx-[18px]">
            {problems.map((p) => (
              <div key={p.cam.id} className="flex flex-wrap items-center gap-3 border-t border-line-soft px-5 py-3 sm:px-[18px]">
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${p.cls}`}>{p.tag}</span>
                <span className="flex min-w-[200px] flex-1 flex-col">
                  <span className="text-sm font-bold">{p.cam.name}</span>
                  <span className="text-xs text-muted">{p.note}</span>
                </span>
                <Link
                  href={`/config/cameras/${encodeURIComponent(p.cam.id)}/zones`}
                  className="inline-flex h-[34px] items-center rounded-[9px] bg-forest px-3 text-[13px] font-bold text-white hover:bg-accent-hover"
                >
                  Buka zona
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Perubahan terbaru"
        actions={
          <Link href="/system-log/audit" className="text-[13px] font-bold text-forest hover:underline">
            Log →
          </Link>
        }
      >
        {auditQuery.isLoading ? (
          <p className="text-sm text-muted">Memuat log audit…</p>
        ) : auditQuery.isError ? (
          <p className="text-sm text-muted">Log audit tidak dapat dimuat.</p>
        ) : audit.length === 0 ? (
          <p className="text-sm text-muted">Belum ada perubahan pada tanggal ini.</p>
        ) : (
          <ul className="-mx-5 sm:-mx-[18px]">
            {audit.map((r) => (
              <li key={r.id} className="flex items-baseline gap-3 border-t border-line-soft px-5 py-2.5 text-[13px] sm:px-[18px]">
                <span className="w-11 shrink-0 font-mono text-xs text-muted">{fmtLocalTime(r.time).slice(0, 5)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{r.actorName}</span>{" "}
                  <span className="text-ink-2">
                    {r.action} · {r.entity}
                    {r.entityId ? ` ${r.entityId}` : ""}
                  </span>
                </span>
                {r.auditCamera && (
                  <span className="shrink-0 rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-extrabold text-gold-ink">Kamera audit</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
