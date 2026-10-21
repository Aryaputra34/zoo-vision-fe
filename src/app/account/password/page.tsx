"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useAuthChangePassword, useAuthLogout } from '@/api/generated/auth/auth';
import { ApiError } from '@/api/http';
import { useMe } from '@/auth/AuthProvider';
import { RequireRole } from '@/auth/RequireRole';
import { PageHeader } from '@/components/ui';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

const inputCls =
  'h-11 rounded-[10px] bg-surface px-3 text-[15px] font-medium text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [wrongCurrent, setWrongCurrent] = useState(false);

  const { me } = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  const changePasswordMutation = useAuthChangePassword();
  const logoutMutation = useAuthLogout();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // ignore
    }
    queryClient.clear();
    router.replace('/login');
  };

  // Live checklist under the fields (same rules the form enforces on submit).
  const checks = [
    { ok: newPassword.length >= 10, t: 'Minimal 10 karakter' },
    { ok: newPassword.length > 0 && newPassword === repeatPassword, t: 'Kedua isian cocok' },
    { ok: newPassword.length > 0 && newPassword !== currentPassword, t: 'Berbeda dari kata sandi saat ini' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setWrongCurrent(false);

    if (newPassword.length < 10) {
      setError('Kata sandi baru minimal 10 karakter.');
      return;
    }

    if (newPassword !== repeatPassword) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        data: {
          currentPassword,
          newPassword,
        },
      });

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'WRONG_PASSWORD') {
          setWrongCurrent(true);
          setError('Kata sandi saat ini salah.');
        } else if (err.statusCode === 429) {
          setError('Terlalu banyak percobaan. Coba lagi sebentar lagi.');
        } else {
          setError(err.message || 'Gagal mengubah kata sandi.');
        }
      } else {
        setError('Terjadi kesalahan. Silakan coba lagi.');
      }
    }
  };

  return (
    <RequireRole min="USER">
      <PageHeader title="Akun saya" subtitle="Profil dan keamanan akun Anda." />
      <div className="flex flex-wrap items-start gap-[18px]">
        {/* Profile */}
        <section aria-label="Profil" className="flex w-full flex-col gap-3.5 md:w-[340px] md:shrink-0">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-[18px] shadow-[0_1px_2px_rgba(19,36,26,0.04)]">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#eaf3dc] font-extrabold text-forest">
                {me ? initials(me.name) : '…'}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-base font-extrabold">{me?.name ?? 'Memuat…'}</span>
              </span>
            </div>
            <dl className="flex flex-col gap-1.5 text-[13px]">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Peran</dt>
                <dd className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[11px] font-extrabold text-forest">{me?.role ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Sesi berakhir</dt>
                <dd className="font-bold">12 jam tanpa aktivitas</dd>
              </div>
            </dl>
            <p className="text-xs leading-relaxed text-muted">Nama dan peran diatur oleh manager atau superadmin.</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#cfc9b8] bg-surface text-sm font-bold text-ink hover:bg-surface-2 disabled:opacity-50"
          >
            <LogOut aria-hidden className="size-4" /> Keluar dari akun
          </button>
        </section>

        {/* Change password */}
        <section
          aria-labelledby="pw-title"
          className="flex min-w-0 flex-[999_1_420px] flex-col gap-4 rounded-2xl border border-line bg-surface p-[22px] shadow-[0_1px_2px_rgba(19,36,26,0.04)]"
        >
          <div className="flex flex-col gap-1">
            <h2 id="pw-title" className="text-lg font-extrabold">Ganti kata sandi</h2>
            <p className="text-[13px] text-muted">Sesi Anda di perangkat lain akan diakhiri. Sesi ini tetap aktif.</p>
          </div>

          {success && (
            <div role="status" className="rounded-[10px] border border-[#b8dec3] bg-good-bg px-3.5 py-3 text-[13px] font-bold text-[#145a2c]">
              Kata sandi diperbarui. Sesi di perangkat lain telah diakhiri.
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-[10px] border border-[#f4c7c1] bg-crit-bg px-3.5 py-3 text-[13px] font-bold text-[#7a160e]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-bold">
              Kata sandi saat ini
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setWrongCurrent(false);
                }}
                required
                autoComplete="current-password"
                aria-invalid={wrongCurrent || undefined}
                className={`${inputCls} ${wrongCurrent ? 'border-2 border-crit' : 'border border-[#cfc9b8]'}`}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                Kata sandi baru
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={10}
                  autoComplete="new-password"
                  className={`${inputCls} border border-[#cfc9b8]`}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                Ulangi kata sandi baru
                <input
                  type="password"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  required
                  minLength={10}
                  autoComplete="new-password"
                  className={`${inputCls} border border-[#cfc9b8]`}
                />
              </label>
            </div>
            <ul aria-label="Syarat kata sandi" className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs font-semibold">
              {checks.map((c) => (
                <li key={c.t} className={c.ok ? 'text-good' : 'text-muted'}>
                  {c.ok ? '✓' : '○'} {c.t}
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="min-h-11 cursor-pointer rounded-[10px] bg-forest px-[18px] text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {changePasswordMutation.isPending ? 'Menyimpan…' : 'Simpan kata sandi'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </RequireRole>
  );
}
