"use client";

import React, { createContext, useContext, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, onUnauthenticated } from '@/api/http';
import { useAuthMe } from '@/api/generated/auth/auth';
import type { ActorDto } from '@/api/generated/zooVisionAPI.schemas';

interface AuthContextValue {
  me: ActorDto | undefined;
  isLoading: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  me: undefined,
  isLoading: false,
  refetch: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const isLoginPage = pathname === '/login';

  // Only a 4xx answers "who am I". Anything else (API restarting, Postgres blip) is retried until it answers:
  // the live socket and the role-aware menu wait for `me`.
  const { data: me, isLoading, refetch } = useAuthMe({
    query: {
      enabled: !isLoginPage,
      retry: (_count, error) => {
        const e = error as unknown;
        return !(e instanceof ApiError && e.statusCode >= 400 && e.statusCode < 500);
      },
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 30_000),
    },
  });

  useEffect(() => {
    const unsubscribe = onUnauthenticated(() => {
      queryClient.clear();
      const current = typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : pathname;

      if (!current.startsWith('/login')) {
        router.replace('/login?next=' + encodeURIComponent(current));
      }
    });
    return unsubscribe;
  }, [router, pathname, queryClient]);

  return (
    <AuthContext.Provider value={{ me, isLoading, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useMe(): { me: ActorDto | undefined; isLoading: boolean } {
  const { me, isLoading } = useContext(AuthContext);
  return { me, isLoading };
}
