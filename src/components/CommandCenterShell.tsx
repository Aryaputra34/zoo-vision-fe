"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsLeft, ChevronsRight, LogOut, Menu, X } from "lucide-react";
import { NAV_SECTIONS, visibleNav, isNavActive, type Role } from "./nav";
import { useMe } from "@/auth/AuthProvider";
import { useAuthLogout } from "@/api/generated/auth/auth";
import { useStatus } from "@/live";
import { BackendBanner } from "./BackendBanner";
import { LivePausedBadge } from "./LivePausedBadge";

const ROLE_CHIP: Record<string, string> = {
  USER: "bg-lime/20 text-[#d9f0b8]",
  MANAGER: "bg-warn-bg text-gold-ink",
  SUPERADMIN: "bg-lime text-forest-dark",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

// Clock in the site time zone, rendered client-side only so server and client markup match.
function useClockWib(): string | null {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const tick = () => setNow(`${fmt.format(new Date())} WIB`);
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// The one place that shows live connection, cameras reporting and the time (the top bar does not repeat it).
function LiveStatusCard({ collapsed }: { collapsed: boolean }) {
  const { cameras, paused } = useStatus();
  const clock = useClockWib();
  const all = Object.entries(cameras);
  const online = all.filter(([, c]) => c !== null).length;
  const waiting = all.length === 0 && !paused;

  const dot = paused ? "bg-warn" : waiting ? "bg-white/40" : "bg-lime camera-pulse";
  const label = paused ? "Data live terhenti" : waiting ? "Menghubungkan…" : "Live tersambung";
  const labelCls = paused ? "text-[#f2c46e]" : "text-[#d9f0b8]";

  if (collapsed) {
    return (
      <Link
        href="/live"
        title={`${label}${all.length ? ` · ${online}/${all.length} kamera melapor` : ""}`}
        className="mx-auto grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5"
      >
        <span className={`size-2.5 rounded-full ${dot}`} />
      </Link>
    );
  }

  return (
    <Link
      href="/live"
      role="status"
      className="mx-3 flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-white transition-colors hover:bg-white/[0.09]"
    >
      <span className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-2 text-xs font-bold ${labelCls}`}>
          <span className={`size-2 rounded-full ${dot}`} />
          {label}
        </span>
        <span className="font-mono text-[11px] font-semibold text-[#94bca0]" suppressHydrationWarning>
          {clock ?? ""}
        </span>
      </span>
      {all.length > 0 && (
        <>
          <span className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-side-ink-2">Kamera melapor</span>
            <span className="text-[15px] font-extrabold tabular-nums">
              {online}
              <span className="font-semibold text-[#94bca0]">/{all.length}</span>
            </span>
          </span>
          <span aria-hidden className="flex h-1.5 gap-[3px]">
            {all.map(([id, c]) => (
              <span key={id} className={`flex-1 rounded-full ${c ? "bg-lime" : "bg-white/25"}`} />
            ))}
          </span>
          <span className="flex gap-3 text-[11px] font-semibold text-side-ink-2">
            <span>{online} online</span>
            {all.length - online > 0 && <span className="text-[#a8b2ac]">{all.length - online} offline</span>}
          </span>
        </>
      )}
    </Link>
  );
}

export function CommandCenterShell({
  children,
}: {
  children: ReactNode;
  showLogout?: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me } = useMe();
  const logoutMutation = useAuthLogout();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // ignore
    }
    queryClient.clear();
    router.replace("/login");
  };

  // The login screen has its own full-page layout: no menu before signing in.
  if (path === "/login") {
    return <>{children}</>;
  }

  const currentRole = (me?.role as Role) || "USER";
  const sections = visibleNav(NAV_SECTIONS, currentRole);

  const crumb = (() => {
    for (const s of sections) {
      const item = s.items.find((i) => isNavActive(i, path));
      if (item) return { section: s.title, label: item.label };
    }
    return { section: sections[0]?.title ?? "", label: sections[0]?.items[0]?.label ?? "" };
  })();

  return (
    <div className="flex min-h-screen bg-bg text-ink selection:bg-lime selection:text-forest">
      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Sidebar: desktop (collapsible) and mobile drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden bg-gradient-to-b from-[#0e3b23] via-side to-[#0a2c1a] text-white transition-[width,transform] duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen ${
          collapsed ? "lg:w-[84px]" : "lg:w-[264px]"
        } ${mobileOpen ? "w-[264px] translate-x-0" : "w-[264px] -translate-x-full lg:translate-x-0"}`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 size-60 rounded-full bg-[radial-gradient(circle,rgba(140,198,63,0.2),transparent_70%)]"
        />

        {/* Brand */}
        <div className={`relative flex shrink-0 items-center gap-2.5 pt-[18px] pb-3.5 ${collapsed ? "justify-center px-3" : "px-4"}`}>
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-2.5"
            title="Elangvision · Taman Safari Bogor"
            onClick={() => setMobileOpen(false)}
          >
            {/* The logo is white artwork: it sits directly on the canopy green. */}
            <Image src="/logo_safari.svg" alt="Logo Taman Safari" width={38} height={38} className="size-[38px] shrink-0 object-contain" priority />
            {!collapsed && (
              <span className="flex min-w-0 flex-col">
                <span className="text-base leading-tight tracking-tight">
                  <span className="font-extrabold">Elang</span>
                  <span className="font-medium">vision</span>
                </span>
                <span className="truncate text-[11px] font-semibold text-[#94bca0]">Taman Safari Bogor</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="grid size-8 place-items-center rounded-lg border border-white/15 text-side-ink-2 hover:bg-white/10 lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="size-4" />
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="hidden size-8 place-items-center rounded-lg border border-white/15 text-side-ink-2 hover:bg-white/10 hover:text-white lg:grid"
              aria-label="Ciutkan sidebar"
              title="Ciutkan sidebar"
            >
              <ChevronsLeft className="size-4" />
            </button>
          )}
        </div>

        <LiveStatusCard collapsed={collapsed} />

        {/* Nav sections */}
        <nav
          aria-label="Navigasi utama"
          className={`relative mt-4 flex-1 space-y-4 overflow-y-auto pb-4 [scrollbar-width:thin] ${collapsed ? "px-3" : "px-3"}`}
        >
          {sections.map((sec) => (
            <div key={sec.title} className="space-y-0.5">
              {!collapsed && (
                <div className="flex items-center gap-2 px-2.5 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7fa88c]">
                  {sec.title}
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              )}
              {sec.items.map((item) => {
                const { href, label, sub, Icon, external } = item;
                const active = isNavActive(item, path);
                const className = `group relative flex items-center gap-3 rounded-xl text-sm transition-colors ${
                  collapsed ? "justify-center px-0 py-2" : "min-h-10 px-3 py-1.5"
                } ${
                  active
                    ? "bg-gradient-to-r from-lime/25 to-lime/[0.06] font-bold text-white"
                    : "font-medium text-[#c9ddcf] hover:bg-white/[0.07] hover:text-white"
                }`;
                const content = (
                  <>
                    {active && (
                      <span
                        aria-hidden
                        className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-lime shadow-[0_0_10px_rgba(140,198,63,0.8)]"
                      />
                    )}
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-lg ${
                        active ? "bg-lime/30 text-white" : "bg-white/5 text-[#c9ddcf] group-hover:text-white"
                      }`}
                    >
                      <Icon aria-hidden className="size-4" />
                    </span>
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
                  </>
                );
                const title = collapsed ? `${label}${sub ? ` · ${sub}` : ""}` : sub;
                if (external) {
                  return (
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer" title={title} className={className}>
                      {content}
                    </a>
                  );
                }
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    title={title}
                    className={className}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User card with sign-out */}
        <div className={`relative shrink-0 p-3 ${collapsed ? "flex flex-col items-center gap-2" : ""}`}>
          {collapsed ? (
            <>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="hidden size-9 place-items-center rounded-lg border border-white/15 text-side-ink-2 hover:bg-white/10 lg:grid"
                aria-label="Perluas sidebar"
                title="Perluas sidebar"
              >
                <ChevronsRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="grid size-9 place-items-center rounded-lg border border-white/15 text-side-ink-2 hover:bg-white/10"
                aria-label="Keluar"
                title="Keluar"
              >
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.06] p-2.5">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-lime to-[#1d6a36] text-xs font-extrabold text-forest-dark">
                {me ? initials(me.name) : "…"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[13px] font-bold">{me?.name ?? "Memuat akun…"}</span>
                {me && (
                  <span
                    className={`self-start rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${
                      ROLE_CHIP[me.role] ?? ROLE_CHIP.USER
                    }`}
                  >
                    {me.role}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-white/10 text-side-ink-2 hover:bg-white/10 hover:text-white disabled:opacity-50"
                aria-label="Keluar"
                title="Keluar"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-md sm:px-7">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-xl border border-line bg-surface text-forest lg:hidden"
            aria-label="Buka menu"
          >
            <Menu className="size-4" />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
            <span className="hidden font-medium text-muted sm:inline">{crumb.section}</span>
            <span aria-hidden className="hidden text-muted sm:inline">/</span>
            <span className="truncate font-bold text-ink">{crumb.label}</span>
          </nav>
          {/* The sidebar status card is hidden on small screens: keep the live warning visible there. */}
          <span className="lg:hidden">
            <LivePausedBadge />
          </span>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-7">
          <BackendBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
