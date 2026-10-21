import { describe, it, expect } from 'vitest';
import { NAV_SECTIONS, visibleNav, isNavActive } from './roles';

describe('visibleNav and roles', () => {
  it('USER sees only monitoring and account; MANAGER adds Pengelolaan and Log sistem; SUPERADMIN adds Token API and Dokumentasi API', () => {
    const labels = (role: 'USER' | 'MANAGER' | 'SUPERADMIN') =>
      visibleNav(NAV_SECTIONS, role).flatMap((s) => s.items.map((i) => i.label));

    const userTitles = visibleNav(NAV_SECTIONS, 'USER').map((s) => s.title);
    expect(userTitles).toEqual(['Pemantauan']);
    expect(labels('USER')).not.toContain('Kamera');
    expect(labels('USER')).not.toContain('Log sistem');

    const managerSections = visibleNav(NAV_SECTIONS, 'MANAGER');
    const managerConfig = managerSections.find((s) => s.title === 'Pengelolaan');
    expect(managerConfig).toBeDefined();
    expect(managerConfig!.items.map((i) => i.label)).toEqual(['Kamera', 'Model AI', 'Pengguna', 'Pengaturan situs']);
    expect(labels('MANAGER')).toContain('Log sistem');
    expect(labels('MANAGER')).not.toContain('Token API');
    expect(labels('MANAGER')).not.toContain('Dokumentasi API');

    const superSystem = visibleNav(NAV_SECTIONS, 'SUPERADMIN').find((s) => s.title === 'Sistem');
    expect(superSystem).toBeDefined();
    expect(superSystem!.items.map((i) => i.label)).toEqual(['Log sistem', 'Token API', 'Dokumentasi API']);
    expect(superSystem!.items.find((i) => i.label === 'Dokumentasi API')?.external).toBe(true);
  });

  it('marks Area operasional, Analitik and Log sistem active on every page under them', () => {
    const item = (label: string) => NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.label === label)!;
    expect(isNavActive(item('Area operasional'), '/cashier')).toBe(true);
    expect(isNavActive(item('Analitik'), '/metrics')).toBe(true);
    expect(isNavActive(item('Log sistem'), '/system-log/logins')).toBe(true);
    expect(isNavActive(item('Ringkasan'), '/live')).toBe(false);
    expect(isNavActive(item('Kamera'), '/config/cameras/cam_1/zones')).toBe(true);
  });
});
