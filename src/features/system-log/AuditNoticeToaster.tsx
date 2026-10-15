"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert, X, ArrowRight } from "lucide-react";
import { useAuditNotices } from "@/live";
import type { AuditNotice } from "@/contract/web";

interface ToastItem extends AuditNotice {
  key: string;
}

export function AuditNoticeToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useAuditNotices((notice) => {
    const item: ToastItem = {
      ...notice,
      key: `${notice.auditId}_${Date.now()}`,
    };
    setToasts((prev) => [item, ...prev.slice(0, 4)]);

    // Auto dismiss after 7 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.key !== item.key));
    }, 7000);
  });

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.key}
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-5"
        >
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-900 mt-0.5">
            <ShieldAlert className="size-4" />
          </div>

          <div className="flex-1 text-xs">
            <p className="font-extrabold text-amber-950">Notifikasi Perubahan Kamera Audit</p>
            <p className="mt-1 font-semibold text-amber-800 leading-relaxed">
              <strong>{t.actorName}</strong> mengubah kamera <strong>{t.cameraId}</strong> ({t.action})
            </p>
            <Link
              href="/system-log/audit"
              className="mt-2 inline-flex items-center gap-1 font-black text-forest hover:underline"
            >
              Lihat di Log Audit <ArrowRight className="size-3" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((item) => item.key !== t.key))}
            className="text-amber-700 hover:text-amber-950"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
