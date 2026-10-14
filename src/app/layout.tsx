import type { Metadata } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import { CommandCenterShell } from "@/components/CommandCenterShell";
import { Providers } from "@/app/providers";
import { authEnabled } from "@/lib/session";
import "./globals.css";

// Nunito: rounded friendly typography matching Gotham Rounded / Mikado used on tamansafari.com
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Taman Safari Indonesia · AI Command Center",
  description: "Official real-time AI computer vision operations platform for Taman Safari Indonesia parks & resorts",
  icons: {
    icon: "/logo_safari.svg",
    shortcut: "/logo_safari.svg",
    apple: "/logo_safari.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${nunito.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('tamansafari_theme') || 'light';
                document.documentElement.setAttribute('data-theme', t);
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-bg font-sans text-ink selection:bg-lime selection:text-forest transition-colors duration-200">
        <Providers>
          <CommandCenterShell showLogout={authEnabled()}>
            {children}
          </CommandCenterShell>
        </Providers>
      </body>
    </html>
  );
}

