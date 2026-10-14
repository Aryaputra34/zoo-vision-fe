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
    if (!error.response) {
      setDown(true);
      throw new ApiError(error.message || 'Network Error', 0, 'NETWORK');
    }

    const { status, data, statusText } = error.response;

    if (status === 503) {
      setDown(true);
    }

    if (status === 401) {
      notifyUnauthenticated();
    }

    if (data && typeof data === 'object' && typeof data.code === 'string') {
      const message = data.message || statusText || `Error ${status}`;
      throw new ApiError(message, status, data.code, data.errors);
    }

    const message = typeof data === 'string' ? data : (data?.message || statusText || `Error ${status}`);
    throw new ApiError(message, status, 'UNKNOWN');
  }
);

export async function apiFetch<T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> {
  const response: AxiosResponse<T> = await http({ ...config, ...options });
  return response.data;
}
