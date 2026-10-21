import { Download } from "lucide-react";

// A plain download link to an /api/v1/exports CSV: the browser sends the session cookie. URLSearchParams encodes
// the '+' of '+07:00' as %2B, which the API needs.
export function CsvLink({ path, params }: { path: string; params: Record<string, string | undefined> }) {
  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined && e[1] !== ""),
  );
  return (
    <a
      href={`${path}?${qs}`}
      className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-white/30 bg-transparent px-3.5 text-[13px] font-bold text-white hover:bg-white/10 transition-colors"
    >
      <Download aria-hidden className="size-3.5" />
      Unduh CSV
    </a>
  );
}
