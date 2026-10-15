"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Sparkles,
  Sun,
  X,
  Radio,
} from "lucide-react";
import { DESTINATIONS, NAV } from "./nav";

export function TamanSafariHeader({ showLogout = false }: { showLogout?: boolean }) {
  const path = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDest, setSelectedDest] = useState(DESTINATIONS[0].id);
  const [lang, setLang] = useState<"en" | "id">("en");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("tamansafari_theme") as "light" | "dark") || "light";
    }
    return "light";
  });
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("tamansafari_theme", newTheme);
  };


  const activeDestination = DESTINATIONS.find((d) => d.id === selectedDest) ?? DESTINATIONS[0];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-forest text-white shadow-xl">
      {/* Top Ticker / Meta Bar */}
      <div className="border-b border-white/10 bg-forest-dark/70 px-4 py-1.5 text-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          {/* Left: Tagline & Park status */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 font-extrabold tracking-wider text-lime uppercase">
              <Sparkles className="size-3.5" />
              Taman Safari Indonesia
            </span>
            <span className="hidden text-white/30 sm:inline">•</span>
            <span className="hidden items-center gap-1.5 text-white/80 sm:flex">
              <span className="size-2 rounded-full bg-lime camera-pulse" />
              <span>
                {lang === "en" ? "Park Status: OPEN" : "Status Taman: BUKA"} (08:30 – 17:00 WIB)
              </span>
            </span>
            <span className="hidden text-white/30 md:inline">•</span>
            <span className="hidden text-white/70 md:inline">
              Cisarua, Bogor · 24°C Berawan Sejuk
            </span>
          </div>

          {/* Right: Live Sync, Theme Toggle, Language */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Light / Dark Mode Toggle */}
            <div className="flex items-center rounded-full border border-white/15 bg-white/5 p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => toggleTheme("light")}
                className={`flex items-center gap-1 cursor-pointer rounded-full px-2 py-0.5 transition-colors ${
                  theme === "light" ? "bg-lime text-forest font-black shadow-sm" : "text-white/70 hover:text-white"
                }`}
                title="Light Mode (Taman Safari Day)"
              >
                <Sun className="size-3" />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button
                type="button"
                onClick={() => toggleTheme("dark")}
                className={`flex items-center gap-1 cursor-pointer rounded-full px-2 py-0.5 transition-colors ${
                  theme === "dark" ? "bg-lime text-forest font-black shadow-sm" : "text-white/70 hover:text-white"
                }`}
                title="Dark Mode (Night Safari)"
              >
                <Moon className="size-3" />
                <span className="hidden sm:inline">Dark</span>
              </button>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center rounded-full border border-white/15 bg-white/5 p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`cursor-pointer rounded-full px-2 py-0.5 transition-colors ${
                  lang === "en" ? "bg-lime text-forest" : "text-white/70 hover:text-white"
                }`}
                title="English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang("id")}
                className={`cursor-pointer rounded-full px-2 py-0.5 transition-colors ${
                  lang === "id" ? "bg-lime text-forest" : "text-white/70 hover:text-white"
                }`}
                title="Bahasa Indonesia"
              >
                ID
              </button>
            </div>

            {/* plain <a>: a <Link> could prefetch /logout and sign the user out */}
            {showLogout && path !== "/login" && (
              <a
                href="/logout"
                className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                title="Keluar"
              >
                <LogOut aria-hidden className="size-3" />
                <span className="hidden sm:inline">Keluar</span>
              </a>
            )}
          </div>
        </div>
      </div>


      {/* Main Header Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Brand Logo & Title */}
        <Link href="/" className="group flex items-center gap-3.5 transition-transform hover:scale-[1.01]">
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-2 shadow-inner ring-1 ring-white/20 backdrop-blur-sm transition-colors group-hover:bg-white/15">
            <Image
              src="/logo_safari.svg"
              alt="Taman Safari Indonesia Logo"
              width={42}
              height={42}
              className="size-full object-contain"
              priority
            />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] font-extrabold tracking-[0.25em] text-lime uppercase">
              Taman Safari Indonesia
            </div>
            <div className="text-xl font-black tracking-tight text-white sm:text-2xl">
              AI Operations <span className="font-light text-lime">Hub</span>
            </div>
          </div>
        </Link>

        {/* Center: Park Destination Selector (tamansafari.com signature) */}
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setDestDropdownOpen(!destDropdownOpen)}
            className="flex cursor-pointer items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white shadow-sm backdrop-blur-md transition-all hover:border-lime/60 hover:bg-white/15"
            aria-expanded={destDropdownOpen}
          >
            <MapPin className="size-3.5 text-lime" />
            <div className="text-left">
              <div className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
                {lang === "en" ? "Selected Park" : "Pilih Destinasi"}
              </div>
              <div className="text-xs font-extrabold text-white">
                {activeDestination.name}
              </div>
            </div>
            <ChevronDown className={`size-3.5 text-white/70 transition-transform ${destDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {destDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 origin-top-left rounded-2xl border border-white/15 bg-forest-dark/95 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-black/20 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 text-[10px] font-extrabold tracking-wider text-lime uppercase">
                {lang === "en" ? "Taman Safari Parks & Resor" : "Jaringan Taman Safari"}
              </div>
              <div className="mt-1 space-y-1">
                {DESTINATIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setSelectedDest(d.id);
                      setDestDropdownOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                      d.id === selectedDest
                        ? "bg-lime text-forest font-black"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div>
                      <div className="font-bold">{d.name}</div>
                      <div className={`text-[10px] ${d.id === selectedDest ? "text-forest/80" : "text-white/50"}`}>
                        {d.location}
                      </div>
                    </div>
                    {d.active ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                        d.id === selectedDest ? "bg-forest text-lime" : "bg-lime/20 text-lime"
                      }`}>
                        <Radio className="size-2.5 animate-pulse" /> Live 4 Cams
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/40">Offline</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Operational Telemetry & AI Status */}
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/vehicles"
            className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white/90 backdrop-blur-sm transition-all hover:border-lime hover:bg-white/15 hover:text-white"
          >
            <Radio className="size-3.5 text-lime animate-pulse" />
            <span>{lang === "en" ? "Gate Traffic Flow" : "Arus Lalu Lintas Gerbang"}</span>
          </Link>

          <div className="flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3.5 py-1.5 text-[11px] font-bold text-lime shadow-inner">
            <span className="size-2 rounded-full bg-lime camera-pulse" />
            <span>4/4 AI Nodes Live</span>
          </div>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex size-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 md:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Primary Navigation Tabs */}
      <nav aria-label="Main Navigation" className="border-t border-white/10 bg-forest-dark/40 px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto py-1.5 [scrollbar-width:none]">
          {NAV.map(({ href, label, sub, Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                  active
                    ? "bg-lime text-forest shadow-md shadow-lime/20"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className={`size-4 transition-transform group-hover:scale-110 ${active ? "text-forest" : "text-lime"}`} />
                <span>{label}</span>
                <span
                  className={`hidden rounded-md px-1.5 py-0.2 text-[9px] font-semibold xl:inline ${
                    active ? "bg-forest/20 text-forest" : "bg-white/10 text-white/60"
                  }`}
                >
                  {sub}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-white/10 bg-forest-dark px-4 py-4 md:hidden animate-in slide-in-from-top">
          {/* Destination picker inside mobile menu */}
          <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] font-extrabold tracking-wider text-lime uppercase">
              {lang === "en" ? "Active Park Destination" : "Taman Safari Aktif"}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs font-black text-white">
              <span>{activeDestination.name}</span>
              <span className="rounded-full bg-lime/20 px-2 py-0.5 text-[9px] text-lime">Live</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {NAV.map(({ href, label, sub, Icon }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                    active ? "bg-lime text-forest font-black" : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="size-4.5" />
                    <span>{label}</span>
                  </div>
                  <span className={`text-[10px] ${active ? "text-forest/70" : "text-white/50"}`}>
                    {sub}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/60">Taman Safari Bogor</span>
            <span className="text-xs text-lime font-bold">WIB (UTC+7)</span>
          </div>
        </div>
      )}
    </header>
  );
}
