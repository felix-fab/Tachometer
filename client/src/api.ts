// Central API client for the Tachometer backend.
// All requests go through the relative `/api` path, which the Vite dev server
// proxies to http://localhost:3001.

import type {
  AuthStatus,
  CalendarResponse,
  Health,
  MonitorResponse,
  Settings,
  SettingsPatch,
  VikunjaConfigured,
  VikunjaTasksResponse,
  WidgetConfig,
  WidgetsResponse,
} from './types';

/** Base path for all backend API routes. */
const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    let message: string | null = null;
    if (data && typeof data === 'object' && 'error' in data) {
      const candidate = (data as { error?: unknown }).error;
      if (typeof candidate === 'string') message = candidate;
    }
    throw new Error(message ?? `HTTP ${res.status}`);
  }

  return data as T;
}

/** GET /api/health */
export function fetchHealth(): Promise<Health> {
  return request<Health>('/health');
}

/** GET /api/monitor */
export function fetchMonitor(): Promise<MonitorResponse> {
  return request<MonitorResponse>('/monitor');
}

/** GET /api/calendar */
export function fetchCalendar(maxEvents?: number): Promise<CalendarResponse> {
  const query = maxEvents ? `?max=${encodeURIComponent(maxEvents)}` : '';
  return request<CalendarResponse>(`/calendar${query}`);
}

/** GET /api/vikunja/tasks */
export function fetchVikunjaTasks(max?: number): Promise<VikunjaTasksResponse> {
  const query = max ? `?max=${encodeURIComponent(max)}` : '';
  return request<VikunjaTasksResponse>(`/vikunja/tasks${query}`);
}

/** GET /api/vikunja/configured */
export function fetchVikunjaConfigured(): Promise<VikunjaConfigured> {
  return request<VikunjaConfigured>('/vikunja/configured');
}

/** GET /api/widgets */
export function fetchWidgets(): Promise<WidgetsResponse> {
  return request<WidgetsResponse>('/widgets');
}

/** PUT /api/widgets/:id */
export async function updateWidget(
  id: string,
  data: { enabled?: boolean; config?: WidgetConfig; slot?: string }
): Promise<void> {
  await request<{ ok: boolean }>(`/widgets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** GET /api/settings */
export function fetchSettings(): Promise<Settings> {
  return request<Settings>('/settings');
}

/** PUT /api/settings */
export async function updateSettings(patch: SettingsPatch): Promise<void> {
  await request<{ ok: boolean }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

/** GET /api/auth/status */
export function fetchAuthStatus(): Promise<AuthStatus> {
  return request<AuthStatus>('/auth/status');
}

/** POST /api/auth/:provider/disconnect */
export async function disconnectProvider(provider: 'google'): Promise<void> {
  await request<{ ok: boolean }>(`/auth/${provider}/disconnect`, {
    method: 'POST',
  });
}

/** OAuth start URLs (navigate directly to them). */
export const OAUTH_START = {
  google: `${BASE}/auth/google/start`,
} as const;
