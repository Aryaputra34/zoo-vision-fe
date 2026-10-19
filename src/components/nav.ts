import { NAV_SECTIONS } from '@/auth/roles';

export {
  NAV_SECTIONS,
  visibleNav,
  isNavActive,
  roleAtLeast,
  type Role,
  type NavItem,
  type NavSection,
} from '@/auth/roles';

export const NAV = NAV_SECTIONS.flatMap((s) => s.items);

export const DESTINATIONS = [
  { id: 'bogor', name: 'Taman Safari Bogor', location: 'Cisarua, Puncak', active: true, cameras: 4 },
  { id: 'prigen', name: 'Taman Safari Prigen', location: 'Pasuruan, Jawa Timur', active: false, cameras: 0 },
  { id: 'bali', name: 'Bali Safari Marine Park', location: 'Gianyar, Bali', active: false, cameras: 0 },
  { id: 'jakarta', name: 'Jakarta Aquarium & Safari', location: 'Neo Soho, Jakarta', active: false, cameras: 0 },
  { id: 'solo', name: 'Solo Safari', location: 'Surakarta, Jawa Tengah', active: false, cameras: 0 },
  { id: 'batang', name: 'Safari Beach Jateng', location: 'Batang, Jawa Tengah', active: false, cameras: 0 },
];
