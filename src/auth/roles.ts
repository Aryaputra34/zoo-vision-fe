import {
  Car,
  Cctv,
  LayoutDashboard,
  ScrollText,
  Store,
  Ticket,
  Utensils,
  BarChart2,
  TrendingUp,
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
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Pusat Kendali',
    items: [
      { href: '/', label: 'Ringkasan', sub: 'Command Center', Icon: LayoutDashboard, minRole: 'USER' },
      { href: '/live', label: 'Live', sub: 'Kamera AI Langsung', Icon: Cctv, minRole: 'USER' },
      { href: '/events', label: 'Log Kejadian', sub: 'Live Incident Stream', Icon: ScrollText, minRole: 'USER' },
    ],
  },
  {
    title: 'Zona Operasional',
    items: [
      { href: '/vehicles', label: 'Gerbang', sub: 'Hitung Kendaraan', Icon: Car, minRole: 'USER' },
      { href: '/cashier', label: 'Loket', sub: 'Loket & Retail Plaza', Icon: Store, minRole: 'USER' },
      { href: '/restaurant', label: 'Restoran', sub: 'Safari Rainforest Dining', Icon: Utensils, minRole: 'USER' },
      { href: '/rides', label: 'Wahana Kuda', sub: 'Animal Encounters Arena', Icon: Ticket, minRole: 'USER' },
    ],
  },
  {
    title: 'Analitik',
    items: [
      { href: '/intervals', label: 'Interval', sub: 'Timeline & Agregasi', Icon: BarChart2, minRole: 'USER' },
      { href: '/metrics', label: 'Metrik', sub: 'Tren & Analisis Operasi', Icon: TrendingUp, minRole: 'USER' },
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
