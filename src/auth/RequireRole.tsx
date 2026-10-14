"use client";

import React, { ReactNode } from 'react';
import { Role, roleAtLeast } from './roles';
import { useMe } from './AuthProvider';

export function RequireRole({ min, children }: { min: Role; children: ReactNode }): ReactNode {
  const { me, isLoading } = useMe();

  if (isLoading) {
    return null;
  }

  if (!me || !roleAtLeast(me.role as Role, min)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">Akses Ditolak</h2>
        <p className="text-ink-muted">Anda tidak punya akses ke halaman ini.</p>
      </div>
    );
  }

  return children;
}
