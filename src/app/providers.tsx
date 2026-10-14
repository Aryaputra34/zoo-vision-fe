"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/api/http";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
                return false;
              }
              if (typeof error === "object" && error !== null && "statusCode" in error) {
                const status = (error as { statusCode?: number }).statusCode;
                if (typeof status === "number" && status >= 400 && status < 500) {
                  return false;
                }
              }
              return failureCount < 1;
            },
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
