"use client";

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuthChangePassword } from '@/api/generated/auth/auth';
import { ApiError } from '@/api/http';
import { RequireRole } from '@/auth/RequireRole';
import { PageHeader } from '@/components/ui';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const changePasswordMutation = useAuthChangePassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

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
        if (err.statusCode === 429) {
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
      <PageHeader title="Akun saya" subtitle="Perbarui kata sandi akun Anda." />
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(19,36,26,0.04)] sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-lime-soft text-forest">
            <Lock aria-hidden className="size-[18px]" />
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-ink">Ganti kata sandi</h2>
            <p className="text-[13px] text-muted">Kata sandi baru minimal 10 karakter.</p>
          </div>
        </div>

        {success && (
          <div className="mb-4 rounded-[10px] border border-good/20 bg-good-bg p-3 text-sm font-semibold text-good">
            Kata sandi berhasil diubah.
          </div>
        )}

        {error && (
          <div role="alert" className="mb-4 rounded-[10px] border border-crit/25 bg-crit-bg p-3 text-sm font-semibold text-[#7a160e]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-1.5 text-[13px] font-bold text-ink">
            Kata sandi saat ini
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11 rounded-[10px] border border-[#cfc9b8] bg-surface px-3.5 text-sm font-medium normal-case tracking-normal text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
            />
          </label>

          <label className="grid gap-1.5 text-[13px] font-bold text-ink">
            Kata sandi baru
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
              className="h-11 rounded-[10px] border border-[#cfc9b8] bg-surface px-3.5 text-sm font-medium normal-case tracking-normal text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
            />
          </label>

          <label className="grid gap-1.5 text-[13px] font-bold text-ink">
            Ulangi kata sandi baru
            <input
              type="password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
              className="h-11 rounded-[10px] border border-[#cfc9b8] bg-surface px-3.5 text-sm font-medium normal-case tracking-normal text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
            />
          </label>

          <button
            type="submit"
            disabled={changePasswordMutation.isPending}
            className="mt-1 h-11 cursor-pointer rounded-[10px] bg-forest text-sm font-extrabold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {changePasswordMutation.isPending ? 'Menyimpan…' : 'Simpan kata sandi'}
          </button>
        </form>
      </div>
    </RequireRole>
  );
}
