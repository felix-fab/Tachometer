// Helpers to apply the theme / accent color as CSS variables on the document root.

export type Theme = 'dark' | 'light';

const ACCENT_DEFAULT = '#e8862a';

/**
 * Apply the theme and accent color to the document root.
 * Sets `data-theme` on <html> and the `--accent` CSS variable.
 */
export function applyTheme(theme?: Theme, accent?: string): void {
  const root = document.documentElement;

  const resolvedTheme: Theme = theme === 'light' ? 'light' : 'dark';
  root.setAttribute('data-theme', resolvedTheme);

  const resolvedAccent = accent && accent.trim() ? accent.trim() : ACCENT_DEFAULT;
  root.style.setProperty('--accent', resolvedAccent);
}

/** Return the current theme from the document root. */
export function getCurrentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
