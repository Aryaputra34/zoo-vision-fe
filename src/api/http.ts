import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export class ApiError extends Error {
  statusCode: number;
  code: string;
  errors?: { path: string; message: string }[];

  constructor(message: string, statusCode: number, code: string, errors?: { path: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const http: AxiosInstance = axios.create();

let isDown = false;
const healthListeners = new Set<(down: boolean) => void>();

function setDown(down: boolean) {
  if (isDown !== down) {
    isDown = down;
    for (const fn of healthListeners) {
      try {
        fn(down);
      } catch (e) {
        console.error('Error in health listener:', e);
      }
    }
  }
}

export const backendHealth = {
  subscribe(fn: (down: boolean) => void): () => void {
    healthListeners.add(fn);
    return () => {
      healthListeners.delete(fn);
    };
  },
  down(): boolean {
    return isDown;
  },
};

const unauthenticatedHandlers = new Set<() => void>();

export function onUnauthenticated(handler: () => void): () => void {
  unauthenticatedHandlers.add(handler);
  return () => {
    unauthenticatedHandlers.delete(handler);
  };
}

// Also called by the live socket when the session has ended.
export function notifyUnauthenticated(): void {
  for (const fn of unauthenticatedHandlers) {
    try {
      fn();
    } catch (e) {
      console.error('Error in unauthenticated handler:', e);
    }
  }
}

http.interceptors.response.use(
  (response) => {
    setDown(false);
    return response;
  },
  (error) => {
    // TanStack aborts requests when a page unmounts or the cache is cleared: that says nothing about the server.
    if (axios.isCancel(error)) {
      throw error;
    }

    if (!error.response) {
      setDown(true);
      throw new ApiError(error.message || 'Network Error', 0, 'NETWORK');
    }

    const { status, data, statusText } = error.response;

    // Behind Caddy a stopped or restarting API is a 502/504 from Caddy, not a network error.
    // stream-info's 503 says MediaMTX is down, not the API: no outage banner for it.
    const mediamtxDown = status === 503 && /\/stream-info$/.test(error.config?.url ?? '');
    if ((status === 502 || status === 503 || status === 504) && !mediamtxDown) {
      setDown(true);
    }

    if (status === 401) {
      notifyUnauthenticated();
    }

    if (data && typeof data === 'object' && typeof data.code === 'string') {
      const message = data.message || statusText || `Error ${status}`;
      throw new ApiError(message, status, data.code, data.errors);
    }

    // A proxy's body is empty or an HTML page: never show it.
    const text = typeof data === 'string' && data.trim() && !data.trimStart().startsWith('<') ? data : undefined;
    const message = text ?? data?.message ?? (statusText || `Server menjawab ${status}`);
    throw new ApiError(message, status, 'UNKNOWN');
  }
);

export async function apiFetch<T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> {
  const response: AxiosResponse<T> = await http({ ...config, ...options });
  return response.data;
}
