"use client";

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthLogin, getAuthMeQueryKey } from '@/api/generated/auth/auth';
import { ApiError } from '@/api/http';
import { safeNext } from '@/auth/safe-next';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const queryClient = useQueryClient();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loginMutation = useAuthLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      const res = await loginMutation.mutateAsync({
        data: { username, password },
      });

      // Update authMe query cache with returned actor/user info
      queryClient.setQueryData(getAuthMeQueryKey(), {
        type: 'user',
        id: res.id,
        name: res.name,
        role: res.role,
      });

      router.replace(safeNext(nextParam));
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setErrorMessage('Nama pengguna atau kata sandi salah.');
        } else if (err.statusCode === 429) {
          setErrorMessage('Terlalu banyak percobaan. Coba lagi sebentar lagi.');
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('Terjadi kesalahan. Silakan coba lagi.');
      }
    }
  };

  return (
    <div className="mx-auto mt-6 w-full max-w-sm rounded-[24px] border border-line bg-surface p-6 shadow-sm sm:mt-12 sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-lime/20 text-forest ring-1 ring-lime/30">
          <LockKeyhole aria-hidden className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-forest">Masuk Dashboard</h1>
          <p className="text-xs font-semibold text-muted">AI Operations &amp; Analytics</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-wider text-forest">
          Nama Pengguna
          <input
            type="text"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
            className="h-11 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold normal-case tracking-normal text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-wider text-forest">
          Kata Sandi
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-11 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold normal-case tracking-normal text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-lime"
          />
        </label>

        {errorMessage && (
          <p role="alert" className="text-xs font-bold text-red-700 dark:text-red-400">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="mt-1 h-11 cursor-pointer rounded-full bg-forest text-sm font-black text-lime shadow-sm transition-colors hover:bg-forest-dark disabled:opacity-50"
        >
          {loginMutation.isPending ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto mt-6 w-full max-w-sm rounded-[24px] border border-line bg-surface p-6 shadow-sm sm:mt-12 sm:p-8 animate-pulse h-64" />
      }
    >
      <LoginForm />
    </Suspense>
  );
}
