"use client";

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
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
    <form onSubmit={handleSubmit} className="flex w-full max-w-[380px] flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[26px] font-extrabold tracking-tight text-ink">Masuk</h2>
        <p className="text-sm text-muted">Gunakan akun karyawan yang diberikan administrator.</p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-[10px] border border-crit/25 bg-crit-bg px-3.5 py-3 text-[13px] leading-snug font-semibold text-[#7a160e]"
        >
          {errorMessage}
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
        Nama pengguna
        <input
          type="text"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          autoComplete="username"
          className="h-12 rounded-[10px] border border-[#cfc9b8] bg-surface px-3.5 text-[15px] font-medium text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
        Kata sandi
        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="h-12 rounded-[10px] border border-[#cfc9b8] bg-surface px-3.5 text-[15px] font-medium text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
        />
      </label>

      <button
        type="submit"
        disabled={loginMutation.isPending}
        className="h-12 cursor-pointer rounded-[10px] bg-forest text-[15px] font-extrabold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {loginMutation.isPending ? 'Memproses…' : 'Masuk'}
      </button>

      <p className="text-[13px] leading-relaxed text-muted">
        Lupa kata sandi? Hubungi manager area Anda atau superadmin untuk mengatur ulang.
      </p>
      <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-xs leading-relaxed text-ink-2">
        <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-forest" />
        <span>Khusus karyawan Taman Safari. Setiap upaya masuk tercatat di riwayat login.</span>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-wrap bg-bg">
      {/* Photo panel */}
      <section className="relative flex min-h-[260px] flex-[1_1_560px] flex-col justify-between overflow-hidden bg-forest-dark text-white">
        <Image
          src="/taman_safari_hero.jpg"
          alt="Panorama Taman Safari Bogor"
          fill
          priority
          sizes="(max-width: 1000px) 100vw, 55vw"
          className="object-cover object-[60%_center]"
        />
        <div aria-hidden className="absolute inset-0 bg-[rgba(6,32,17,0.55)]" />
        <div className="relative flex items-center gap-3 px-8 pt-8 sm:px-11 sm:pt-9">
          <Image src="/logo_safari.svg" alt="Logo Taman Safari" width={42} height={42} className="size-[42px]" />
          <span className="flex flex-col">
            <span className="text-[19px] tracking-tight">
              <span className="font-extrabold">Elang</span>
              <span className="font-medium">vision</span>
            </span>
            <span className="text-[13px] font-semibold text-[#cfe3d4]">Taman Safari Bogor</span>
          </span>
        </div>
        <div className="relative flex max-w-[600px] flex-col gap-4 px-8 pt-10 pb-10 sm:px-11 sm:pb-11">
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-[38px]">Pusat pemantauan operasional taman</h1>
          <p className="max-w-[520px] text-base leading-relaxed text-[#e4efe7]">
            Sistem pemantauan kamera internal untuk tim operasional, pengawas area, dan IT Taman Safari Bogor.
          </p>
        </div>
      </section>

      {/* Form panel */}
      <section className="flex flex-[1_1_420px] items-center justify-center px-6 py-12 sm:px-8">
        <Suspense fallback={<div className="h-80 w-full max-w-[380px] animate-pulse rounded-2xl bg-surface-2" />}>
          <LoginForm />
        </Suspense>
      </section>
    </div>
  );
}
