import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { CommandCenterShell } from "@/components/CommandCenterShell";
import { Providers } from "@/app/providers";
import { AuthProvider } from "@/auth/AuthProvider";
import { SiteZoneGate } from "@/lib/SiteZoneGate";
import { LiveProvider } from "@/live/LiveProvider";
import { AuditNoticeToaster } from "@/features/system-log/AuditNoticeToaster";
import "./globals.css";

// Plus Jakarta Sans: the Elangvision redesign typeface (UI text); Geist Mono for IDs, times and figures.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Elangvision · Taman Safari Bogor",
  description: "Sistem pemantauan kamera AI internal Taman Safari Bogor",
  icons: {
    icon: "/logo_safari.svg",
    shortcut: "/logo_safari.svg",
    apple: "/logo_safari.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-theme="light" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-bg font-sans text-ink selection:bg-lime selection:text-forest">
        <Providers>
          <AuthProvider>
            <SiteZoneGate>
              <LiveProvider>
                <CommandCenterShell>
                  {children}
                </CommandCenterShell>
                <AuditNoticeToaster />
              </LiveProvider>
            </SiteZoneGate>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
