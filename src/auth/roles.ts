import {
  Cctv,
  MapPinned,
  LayoutDashboard,
  ScrollText,
  BarChart2,
  Camera,
  Cpu,
  Users,
  Key,
  ShieldAlert,
  LogIn,
  Server,
  Lock,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

export type Role = 'USER' | 'MANAGER' | 'SUPERADMIN';

const ROLE_RANK: Record<Role, number> = {
  USER: 1,
  MANAGER: 2,
  SUPERADMIN: 3,
};

export function roleAtLeast(role: Role, min: Role): boolean {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[min] ?? 0);
}

export type NavItem = {
  href: string;
  label: string;
  sub?: string;
  Icon: LucideIcon;
  minRole: Role;
  external?: boolean;
  /** Path prefixes that also mark this item active (pages reached through tabs). Defaults to `href`. */
  match?: string[];
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    // One menu for everyday monitoring. Area operasional and Analitik open their first page; the pages under
    // them switch with tabs (same routes as before), and `match` keeps the menu item lit on each of them.
    title: 'Pemantauan',
    items: [
      { href: '/', label: 'Ringkasan', sub: 'Kondisi taman hari ini', Icon: LayoutDashboard, minRole: 'USER' },
      { href: '/live', label: 'Live kamera', sub: 'Tayangan langsung', Icon: Cctv, minRole: 'USER' },
      { href: '/events', label: 'Kejadian', sub: 'Log deteksi AI', Icon: ScrollText, minRole: 'USER' },
      {
        href: '/vehicles',
        label: 'Area operasional',
        sub: 'Gerbang, loket, restoran, wahana',
        Icon: MapPinned,
        minRole: 'USER',
        match: ['/vehicles', '/cashier', '/restaurant', '/rides'],
      },
      {
        href: '/intervals',
        label: 'Analitik',
        sub: 'Interval dan metrik',
        Icon: BarChart2,
        minRole: 'USER',
        match: ['/intervals', '/metrics'],
      },
    ],
  },
  {
    title: 'Konfigurasi',
    items: [
      { href: '/config/cameras', label: 'Kamera', sub: 'Manajemen Stream & Zona', Icon: Camera, minRole: 'MANAGER' },
      { href: '/config/models', label: 'Model AI', sub: 'Deteksi & Ambang Batas', Icon: Cpu, minRole: 'MANAGER' },
      { href: '/config/users', label: 'Pengguna', sub: 'Akun & Hak Akses', Icon: Users, minRole: 'MANAGER' },
      { href: '/config/api-tokens', label: 'Token API', sub: 'Integrasi Eksternal', Icon: Key, minRole: 'SUPERADMIN' },
    ],
  },
  {
    title: 'Log Sistem',
    items: [
      { href: '/system-log/audit', label: 'Audit', sub: 'Jejak Perubahan Sistem', Icon: ShieldAlert, minRole: 'MANAGER' },
      { href: '/system-log/logins', label: 'Riwayat Login', sub: 'Sesi & Autentikasi', Icon: LogIn, minRole: 'MANAGER' },
      { href: '/system-log/system-events', label: 'Kejadian Sistem', sub: 'Log Layanan & API', Icon: Server, minRole: 'MANAGER' },
    ],
  },
  {
    title: 'Akun',
    items: [
      { href: '/account/password', label: 'Ganti Kata Sandi', sub: 'Keamanan Akun', Icon: Lock, minRole: 'USER' },
      { href: '/api/docs', label: 'API Docs', sub: 'Dokumentasi Swagger API', Icon: BookOpen, minRole: 'SUPERADMIN', external: true },
    ],
  },
];

export function visibleNav(sections: NavSection[], role: Role): NavSection[] {
  return sections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => roleAtLeast(role, item.minRole)),
    }))
    .filter((sec) => sec.items.length > 0);
}

// Whether a nav item is the current page: `/` only on itself, others on their own prefix or any `match` prefix.
export function isNavActive(item: Pick<NavItem, 'href' | 'match'>, path: string): boolean {
  if (item.href === '/') return path === '/';
  const prefixes = item.match ?? [item.href];
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}
