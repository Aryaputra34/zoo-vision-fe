"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleDot, Film, Info, OctagonAlert, Play, Save, X, type LucideIcon } from "lucide-react";
import { useEvidenceKeep } from "@/api/generated/evidence/evidence";
import { EvidenceStatus, type EventEvidenceDto } from "@/api/generated/zooVisionAPI.schemas";
import { ApiError } from "@/api/http";
import { useMe } from "@/auth/AuthProvider";
import { roleAtLeast } from "@/auth/roles";
import { Badge, type Tone } from "@/components/ui";
import { isLiveDataKey } from "@/live";

const dialogCls =
  "m-auto w-[min(960px,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/70";
const closeBtn =
  "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-surface text-forest hover:bg-lime/20";

// `chip` is the short word on the 64 px thumbnail; `label` is the full one in the dialog.
const EVIDENCE: Record<EventEvidenceDto["status"], { label: string; chip: string; tone: Tone; Icon: LucideIcon; chipCls: string }> = {
  [EvidenceStatus.KEPT]: { label: "Disimpan", chip: "Disimpan", tone: "good", Icon: CircleCheck, chipCls: "bg-good-bg text-good" },
  [EvidenceStatus.QUEUED]: { label: "Menyimpan…", chip: "Proses", tone: "info", Icon: Info, chipCls: "bg-info-bg text-info" },
  [EvidenceStatus.FAILED]: { label: "Gagal", chip: "Gagal", tone: "crit", Icon: OctagonAlert, chipCls: "bg-crit-bg text-crit-ink" },
  [EvidenceStatus.NO_RECORDING]: { label: "Tanpa rekaman", chip: "Kosong", tone: "off", Icon: CircleDot, chipCls: "bg-off-bg text-muted" },
};

// An event's evidence from its row's snapshotUrl and clipUrl. Both are /media URLs behind the session.
// A clip that fails to load (404 RECORDING_NOT_AVAILABLE, or the recording is gone) shows "Rekaman tidak tersedia".
// With `eventId` and `evidence` it also shows the kept-clip status, and a MANAGER can keep the clip by hand.
export function EvidenceButton({
  snapshotUrl,
  clipUrl,
  title,
  eventId,
  evidence,
}: {
  snapshotUrl: string | null;
  clipUrl: string | null;
  title: string;
  eventId?: string;
  evidence?: EventEvidenceDto | null;
}) {
  const { me } = useMe();
  const queryClient = useQueryClient();
  // The answer of "Simpan bukti", shown at once; the row's own status wins again as soon as it changes.
  const [kept, setKept] = useState<{ from: string | null; value: EventEvidenceDto } | null>(null);
  const [keepError, setKeepError] = useState<string | null>(null);
  const keep = useEvidenceKeep({
    mutation: {
      onSuccess: (r) => {
        setKeepError(null);
        setKept({ from: evidence?.status ?? null, value: { status: r.status, reason: r.reason } });
        void queryClient.invalidateQueries({ predicate: (q) => isLiveDataKey(q.queryKey) });
      },
      onError: (err) => setKeepError(err instanceof ApiError && err.message ? err.message : "Gagal menyimpan bukti."),
    },
  });
  const shown = kept && kept.from === (evidence?.status ?? null) ? kept.value : (evidence ?? null);
  const status = shown ? EVIDENCE[shown.status] : null;
  const canKeep =
    !!eventId &&
    !!me &&
    roleAtLeast(me.role, "MANAGER") &&
    shown?.status !== EvidenceStatus.KEPT &&
    shown?.status !== EvidenceStatus.QUEUED;

  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [snapshotFailed, setSnapshotFailed] = useState(false);
  const [clipFailed, setClipFailed] = useState(false);
  if (!snapshotUrl && !clipUrl) return <span className="text-muted">—</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        aria-label={`Lihat bukti kejadian ${title}`}
        className="group relative block h-10 w-16 cursor-pointer overflow-hidden rounded-lg border border-line bg-surface-2 hover:ring-2 hover:ring-lime"
      >
        {snapshotUrl && !snapshotFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- a session-protected JPEG from the API, nothing to optimize
          <img src={snapshotUrl} alt="" loading="lazy" onError={() => setSnapshotFailed(true)} className="size-full object-cover" />
        ) : (
          <Film aria-hidden className="m-auto size-4 text-forest" />
        )}
        {status && (
          <span
            title={`Bukti: ${status.label}`}
            className={`absolute left-0.5 top-0.5 inline-flex max-w-[calc(100%-4px)] items-center gap-0.5 rounded px-1 text-[10px] leading-4 font-bold ${status.chipCls}`}
          >
            <status.Icon aria-hidden className="size-2.5 shrink-0" />
            <span className="truncate">{status.chip}</span>
          </span>
        )}
        {clipUrl && (
          <span className="absolute right-0.5 bottom-0.5 grid size-4 place-items-center rounded-full bg-forest/90 text-lime">
            <Play aria-hidden className="size-2.5" />
          </span>
        )}
      </button>
      <dialog
        ref={dialog}
        onClose={() => {
          setOpen(false);
          setClipFailed(false);
          setKeepError(null);
        }}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className={dialogCls}
      >
        {open && (
          <div className="grid gap-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold text-forest">{title}</h2>
                {status && <Badge tone={status.tone}>{`Bukti: ${status.label}`}</Badge>}
              </div>
              <button type="button" onClick={() => dialog.current?.close()} aria-label="Tutup" className={closeBtn}>
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <div className={`grid gap-4 ${snapshotUrl && clipUrl ? "md:grid-cols-2" : ""}`}>
              {snapshotUrl && (
                <figure className="grid gap-1.5">
                  {snapshotFailed ? (
                    <div className="grid aspect-video place-items-center rounded-xl bg-surface-2 p-4 text-center text-xs font-bold text-ink-2">
                      Snapshot tidak tersedia
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- a session-protected JPEG from the API
                    <img src={snapshotUrl} alt={`Snapshot ${title}`} className="w-full rounded-xl bg-black" />
                  )}
                  <figcaption className="text-xs font-semibold text-muted">Snapshot saat kejadian (anotasi AI)</figcaption>
                </figure>
              )}
              {clipUrl && (
                <figure className="grid gap-1.5">
                  {clipFailed ? (
                    <div className="grid aspect-video place-items-center rounded-xl bg-surface-2 p-4 text-center text-xs font-bold text-ink-2">
                      Rekaman tidak tersedia
                    </div>
                  ) : (
                    <video
                      src={clipUrl}
                      controls
                      autoPlay
                      muted
                      playsInline
                      onError={() => setClipFailed(true)}
                      className="w-full rounded-xl bg-black"
                    />
                  )}
                  <figcaption className="text-xs font-semibold text-muted">Klip rekaman di sekitar waktu kejadian</figcaption>
                </figure>
              )}
            </div>
            {canKeep && (
              <div className="flex flex-wrap items-center justify-end gap-3">
                {keepError && <span className="text-xs font-bold text-crit-ink">{keepError}</span>}
                <button
                  type="button"
                  disabled={keep.isPending}
                  onClick={() => eventId && keep.mutate({ id: eventId })}
                  className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2 text-xs font-extrabold text-white shadow-md hover:bg-forest-dark disabled:opacity-50"
                >
                  <Save aria-hidden className="size-4" />
                  {keep.isPending ? "Menyimpan..." : "Simpan bukti"}
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
