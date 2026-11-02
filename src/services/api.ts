import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'nutrisync_session_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getApiErrorMessage(err: unknown, fallback = 'Request failed. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string })?.error || err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
