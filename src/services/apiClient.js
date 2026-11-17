import axios from 'axios';
import { enforceRateLimit, getSafePublicConfig, sanitizeFormPayload } from '../utils/security';

/**
 * Axios client configured for the Go + PostgreSQL REST backend (/api/v1).
 * Security features:
 * - Zero secret exposure: reads only whitelisted public URL/flag via getSafePublicConfig()
 * - Automatic payload sanitization on POST/PUT/PATCH requests
 * - Client-side sliding-window rate limiting + 429 Retry-After handling
 * - HttpOnly cookies (withCredentials: true) + in-memory JWT Bearer token
 */
let inMemoryAccessToken = null;
const publicConfig = getSafePublicConfig();

export function setAccessToken(token) {
  inMemoryAccessToken = token || null;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

export const apiClient = axios.create({
  baseURL: publicConfig.apiBaseUrl,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

apiClient.interceptors.request.use((cfg) => {
  enforceRateLimit('api', cfg.url || 'global');

  if (inMemoryAccessToken) {
    cfg.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  if (cfg.data && typeof cfg.data === 'object') {
    cfg.data = sanitizeFormPayload(cfg.data);
  }
  return cfg;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'] || error.response?.data?.retryAfter || 5;
      const msg = error.response?.data?.message || `Too many requests. Please wait ${retryAfter}s and try again.`;
      return Promise.reject(Object.assign(new Error(msg), { status: 429, retryAfter }));
    }
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Network error';
    return Promise.reject(Object.assign(new Error(message), { status }));
  },
);

export const DEMO_MODE = publicConfig.demoMode;
