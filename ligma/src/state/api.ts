import axios, { type AxiosRequestConfig } from 'axios';
import type { Session, User, Role, Task, EventRow } from './types';

const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

function normalizeApiOrigin(value?: string): string {
  if (!value) return '';
  const trimmed = value.replace(/\/$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

const apiOrigin = normalizeApiOrigin(rawApiUrl);
const BASE = apiOrigin ? `${apiOrigin}/api` : '/api';
const LOCAL_FALLBACK_BASE =
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
    ? 'http://127.0.0.1:18083/api'
    : '';

async function requestWithFallback<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await axios.request<T>(config);
    return response.data;
  } catch (error) {
    if (!LOCAL_FALLBACK_BASE) throw error;
    const url = String(config.url ?? '');
    if (!url.startsWith('/api/') || url.startsWith(LOCAL_FALLBACK_BASE)) throw error;
    const fallbackResponse = await axios.request<T>({
      ...config,
      url: `${LOCAL_FALLBACK_BASE}${url.slice('/api'.length)}`,
    });
    return fallbackResponse.data;
  }
}

export const api = {
  sessions: {
    list: () => requestWithFallback<Session[]>({ method: 'GET', url: `${BASE}/sessions` }),
    create: (name: string) => requestWithFallback<Session>({ method: 'POST', url: `${BASE}/sessions`, data: { name } }),
  },

  users: {
    list: () => requestWithFallback<User[]>({ method: 'GET', url: `${BASE}/users` }),
    create: (name: string, role: Role, color: string) =>
      requestWithFallback<User>({ method: 'POST', url: `${BASE}/users`, data: { name, role, color } }),
    updateRole: (id: string, role: Role) =>
      requestWithFallback<User>({ method: 'PATCH', url: `${BASE}/users/${id}`, data: { role } }),
  },

  tasks: {
    list: (sessionId: string) =>
      requestWithFallback<Task[]>({ method: 'GET', url: `${BASE}/tasks/${sessionId}` }),
  },

  events: {
    list: (sessionId: string) =>
      requestWithFallback<EventRow[]>({ method: 'GET', url: `${BASE}/events/${sessionId}` }),
  },

  replay: {
    get: (sessionId: string, seq: number) =>
      requestWithFallback<{ events: EventRow[] }>({ method: 'GET', url: `${BASE}/replay/${sessionId}?seq=${seq}` }),
  },

  classify: {
    text: (text: string) =>
      requestWithFallback({ method: 'POST', url: `${BASE}/classify`, data: { text } }),
  },

  summary: {
    get: (sessionId: string) =>
      requestWithFallback({ method: 'GET', url: `${BASE}/summary/${sessionId}` }),
  },
};
