// Central refresh intervals for automatic data updates across the app.
// These keep the widgets and stats pages in sync with the backend.
// Adjust the cadence here to change the refresh behavior app-wide.

export const REFRESH = {
  /** Calendar events — refresh every 5 minutes. */
  calendarMs: 5 * 60_000,
  /** Vikunja tasks — refresh every 2 minutes. */
  vikunjaMs: 2 * 60_000,
  /** Stats / monitor data (EdenAI balance, website probes) — refresh every 2 minutes. */
  monitorMs: 2 * 60_000,
} as const;
