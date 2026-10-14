"use client";

import React, { createContext, useContext, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { onUnauthenticated } from '@/api/http';
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

  const { data: me, isLoading, refetch } = useAuthMe({
    query: {
      enabled: !isLoginPage,
      retry: false,
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
