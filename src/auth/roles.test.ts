import { describe, it, expect } from 'vitest';
import { NAV_SECTIONS, visibleNav } from './roles';

describe('visibleNav and roles', () => {
  it('USER sees no Konfigurasi or Log Sistem; MANAGER sees them without Token API; SUPERADMIN sees everything', () => {
    const userSections = visibleNav(NAV_SECTIONS, 'USER');
    const userTitles = userSections.map((s) => s.title);
    expect(userTitles).not.toContain('Konfigurasi');
    expect(userTitles).not.toContain('Log Sistem');

    const managerSections = visibleNav(NAV_SECTIONS, 'MANAGER');
    const managerTitles = managerSections.map((s) => s.title);
    expect(managerTitles).toContain('Konfigurasi');
    expect(managerTitles).toContain('Log Sistem');

    const configSection = managerSections.find((s) => s.title === 'Konfigurasi');
    expect(configSection).toBeDefined();
    const configItems = configSection!.items.map((i) => i.label);
    expect(configItems).toContain('Kamera');
    expect(configItems).toContain('Model AI');
    expect(configItems).toContain('Pengguna');
    expect(configItems).not.toContain('Token API');

    const superAdminSections = visibleNav(NAV_SECTIONS, 'SUPERADMIN');
    const superAdminConfig = superAdminSections.find((s) => s.title === 'Konfigurasi');
    expect(superAdminConfig).toBeDefined();
    const superAdminConfigItems = superAdminConfig!.items.map((i) => i.label);
    expect(superAdminConfigItems).toContain('Token API');

    const superAdminAccount = superAdminSections.find((s) => s.title === 'Akun');
    expect(superAdminAccount).toBeDefined();
    const superAdminAccountItems = superAdminAccount!.items.map((i) => i.label);
    expect(superAdminAccountItems).toContain('API Docs');
  });
});
