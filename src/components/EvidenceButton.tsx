"use client";

import { useRef, useState } from "react";
import { Film, Play, X } from "lucide-react";

const dialogCls =
  "m-auto w-[min(960px,calc(100vw-2rem))] rounded-[24px] border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/70";
const closeBtn =
  "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-surface text-forest hover:bg-lime/20";

// An event's evidence from its row's snapshotUrl and clipUrl. Both are /media URLs behind the session.
// A clip that fails to load (404 RECORDING_NOT_AVAILABLE, or the recording is gone) shows "Rekaman tidak tersedia".
export function EvidenceButton({
  snapshotUrl,
  clipUrl,
  title,
}: {
  snapshotUrl: string | null;
  clipUrl: string | null;
  title: string;
}) {
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
        }}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className={dialogCls}
      >
        {open && (
          <div className="grid gap-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black text-forest">{title}</h2>
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
          </div>
        )}
      </dialog>
    </>
  );
}
