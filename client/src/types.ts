// Shared TypeScript types for the Tachometer dashboard frontend.

/** A single calendar event, as returned by the backend calendar endpoint. */
export interface CalendarEvent {
  id: string;
  source: 'google';
  calendarId: string | null;
  calendarName: string | null;
  color: string | null;
  summary: string;
  location: string | null;
  start: string | null;
  end: string | null;
  allDay: boolean;
}

/** Response of GET /api/calendar. */
export interface CalendarResponse {
  events: CalendarEvent[];
  errors: string[];
}

/** A Vikunja task, as returned by the backend Vikunja endpoint. */
export interface VikunjaTask {
  id: number;
  identifier: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: number;
  percentDone: number;
  projectId: number | null;
  project: string;
  projectColor: string;
  labels: string[];
  assignees: string[];
  createdAt: string | null;
}

/** Response of GET /api/vikunja/tasks. */
export interface VikunjaTasksResponse {
  configured: boolean;
  tasks: VikunjaTask[];
}

/** Response of GET /api/vikunja/configured. */
export interface VikunjaConfigured {
  configured: boolean;
}

/** A widget configuration object (arbitrary per-widget settings). */
export type WidgetConfig = Record<string, unknown>;

/** A widget as stored in the backend. */
export interface Widget {
  id: string;
  enabled: boolean;
  config: WidgetConfig;
  slot: string | null;
}

/** Response of GET /api/widgets. */
export type WidgetsResponse = Widget[];

/** Settings exposed by the backend. */
export interface Settings {
  theme?: 'dark' | 'light';
  clock_24h?: boolean;
  clock_seconds?: boolean;
  accent?: string;
  google_calendars?: string[];
  /** Masked EdenAI management key (only last 4 chars visible). */
  edenai_key?: string;
  /** List of monitored websites (with optional display titles). */
  monitor_urls?: (string | MonitorSite)[];
  /** Which EdenAI values to show and over what period. */
  edenai_display?: EdenaiDisplayConfig;
  /** Whether the dashboard/stats auto-rotation is enabled. */
  auto_rotate_enabled?: boolean;
  /** Seconds to wait before switching between dashboard and stats. */
  auto_rotate_seconds?: number;
  /** Whether automatic data refresh is enabled. */
  auto_refresh_enabled?: boolean;
  /** Seconds between automatic data refreshes. */
  auto_refresh_seconds?: number;
}

/** A sub-set of settings that may be sent to PUT /api/settings. */
export type SettingsPatch = Partial<Settings>;

/** Response of GET /api/auth/status. */
export interface AuthStatus {
  google: ProviderStatus;
}

export interface ProviderStatus {
  configured: boolean;
  connected: boolean;
}

/** Response of GET /api/health. */
export interface Health {
  ok: boolean;
  time: string;
}

/** A single website reachability probe result. */
export interface WebsiteProbe {
  /** Display title for the site (may be derived from the URL host). */
  title: string;
  url: string;
  reachable: boolean;
  status: number | null;
  latencyMs: number;
  error?: string;
}

/** A monitored website with an optional display title. */
export interface MonitorSite {
  title?: string;
  url: string;
}

/** EdenAI credit balance result. */
export interface EdenaiBalance {
  configured: boolean;
  balance: number | null;
  currency?: string;
  error?: string;
}

/** EdenAI usage (cost + calls) over a period. */
export interface EdenaiUsage {
  usage?: number;
  calls?: number;
  /** Change in cost since the previous reading. */
  usageDelta?: number;
  /** Change in calls since the previous reading. */
  callsDelta?: number;
  /** Percent change in cost since the previous reading (null if no baseline). */
  usagePercent?: number | null;
  /** Percent change in calls since the previous reading (null if no baseline). */
  callsPercent?: number | null;
  error?: string;
}

/** Configured EdenAI display options (which values + period). */
export interface EdenaiDisplayConfig {
  values: ('balance' | 'usage' | 'calls')[];
  periodDays: number;
}

/** EdenAI section of the monitor response. */
export interface EdenaiMonitor {
  display: EdenaiDisplayConfig;
  balanceData?: EdenaiBalance | null;
  usageData?: EdenaiUsage | null;
}

/** Response of GET /api/monitor. */
export interface MonitorResponse {
  edenai: EdenaiMonitor;
  websites: WebsiteProbe[];
  updatedAt: string;
}
