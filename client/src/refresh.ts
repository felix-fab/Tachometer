// Simple global refresh mechanism.
// The refresh button dispatches a custom event that the data-driven
// views (widgets, stats) listen to and re-fetch their data.

const REFRESH_EVENT = 'tachometer:refresh';

/** Trigger a data refresh for all listening views. */
export function triggerRefresh(): void {
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
}

/** Subscribe to refresh events; returns an unsubscribe function. */
export function onRefresh(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(REFRESH_EVENT, handler);
  return () => window.removeEventListener(REFRESH_EVENT, handler);
}
