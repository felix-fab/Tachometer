// Refresh helpers for automatic data updates across the app.
// The refresh cadence is now driven by the user's "Daten" settings.

/** Clamp a refresh interval (seconds) into a sane range. */
export function clampRefreshSeconds(value: number): number {
  return Math.max(10, Math.min(3600, Number.isFinite(value) ? value : 60));
}

/**
 * Resolve the automatic refresh interval in milliseconds from the user's
 * settings. Returns `null` when auto-refresh is disabled (no automatic
 * polling; data only updates via the manual refresh button).
 */
export function autoRefreshMs(settings: {
  auto_refresh_enabled?: boolean;
  auto_refresh_seconds?: number;
}): number | null {
  if (settings.auto_refresh_enabled !== true) return null;
  return clampRefreshSeconds(settings.auto_refresh_seconds ?? 60) * 1000;
}
