// Minimal hash-based client-side router.
// Routes are driven by `window.location.hash` (e.g. `#/` or `#/settings`).

import { useEffect, useState } from 'react';

/** Parse the current hash into a path (without the leading `#`). */
export function getHashPath(): string {
  const hash = window.location.hash;
  if (!hash || hash === '#') return '/';
  return hash.replace(/^#/, '');
}

/** Current route path, updated whenever the hash changes. */
export function useHashRoute(): string {
  const [path, setPath] = useState<string>(() => getHashPath());

  useEffect(() => {
    const onHashChange = () => setPath(getHashPath());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return path;
}

/** Programmatically navigate to a hash route. */
export function navigate(path: string): void {
  window.location.hash = path;
}
