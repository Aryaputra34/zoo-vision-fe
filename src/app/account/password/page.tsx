"use client";

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuthChangePassword } from '@/api/generated/auth/auth';
import { ApiError } from '@/api/http';
import { RequireRole } from '@/auth/RequireRole';

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
      <div className="mx-auto mt-6 w-full max-w-md rounded-[24px] border border-line bg-surface p-6 shadow-sm sm:mt-12 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-lime/20 text-forest ring-1 ring-lime/30">
            <Lock aria-hidden className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-forest">Ganti Kata Sandi</h1>
            <p className="text-xs font-semibold text-muted">Perbarui kata sandi akun Anda</p>
          </div>
        </div>

        {success && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-800 dark:text-emerald-300">
            Kata sandi berhasil diubah.
          </div>
        )}

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-wider text-forest">
            Kata Sandi Saat Ini
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold normal-case tracking-normal text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-wider text-forest">
            Kata Sandi Baru (Min. 10 Karakter)
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
              className="h-11 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold normal-case tracking-normal text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-wider text-forest">
            Ulangi Kata Sandi Baru
            <input
              type="password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
              className="h-11 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold normal-case tracking-normal text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
            />
          </label>

          <button
            type="submit"
            disabled={changePasswordMutation.isPending}
            className="mt-2 h-11 cursor-pointer rounded-full bg-forest text-sm font-black text-lime shadow-sm transition-colors hover:bg-forest-dark disabled:opacity-50"
          >
            {changePasswordMutation.isPending ? 'Menyimpan...' : 'Simpan Kata Sandi'}
          </button>
        </form>
      </div>
    </RequireRole>
  );
}
