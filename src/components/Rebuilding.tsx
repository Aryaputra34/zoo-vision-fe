import { Construction, Sparkles } from "lucide-react";

export function Rebuilding({ title, task }: { title: string; task: string }) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-lime/20 px-3 py-0.5 text-[11px] font-extrabold text-forest uppercase tracking-wider">
            <Sparkles className="size-3 text-forest" />
            Dalam Proses Migrasi · {task}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-forest sm:text-3xl lg:text-4xl">
            {title}
          </h1>
        </div>
      </header>

      {/* Notice Card */}
      <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12 text-center shadow-sm">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-surface-2 text-forest ring-1 ring-lime/30 shadow-inner">
          <Construction className="size-8 text-forest" />
        </div>
        <h2 className="mt-4 text-lg font-extrabold tracking-tight text-forest">
          Pembaruan Integrasi API
        </h2>
        <p className="mt-2 text-sm font-semibold text-ink-2">
          Halaman ini sedang dipindahkan ke API baru ({task}).
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-1.5 text-xs font-bold text-muted">
          <span>Modul Target:</span>
          <span className="font-mono text-forest font-extrabold">{task}</span>
        </div>
      </div>
    </div>
  );
}
