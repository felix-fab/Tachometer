import 'dotenv/config';
import { getSetting } from './db.js';

/** Derive a display title from a URL host, e.g. "https://example.com" → "Example". */
function titleFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host
      .split('.')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return url;
  }
}

/** Parse a monitor_urls entry that may be a plain URL string or an object {title, url}. */
function normalizeMonitorEntry(entry) {
  if (entry && typeof entry === 'object') {
    const url = String(entry.url || '').trim();
    if (!url) return null;
    const title = String(entry.title || '').trim();
    return { title: title || titleFromUrl(url), url };
  }
  const raw = String(entry || '').trim();
  if (!raw) return null;
  // Support "Titel | URL" on a single line for convenience.
  const pipe = raw.indexOf('|');
  if (pipe !== -1) {
    const title = raw.slice(0, pipe).trim();
    const url = raw.slice(pipe + 1).trim();
    if (url) return { title: title || titleFromUrl(url), url };
  }
  return { title: titleFromUrl(raw), url: raw };
}

/** Parse a stored monitor_urls value (JSON array) into a list of {title, url}. */
function parseMonitorUrls(raw) {
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
      else if (parsed && typeof parsed === 'object') list = [parsed];
    } catch {
      /* fall through to comma-split */
    }
    if (list.length === 0) {
      list = raw
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
    }
  }
  return list.map(normalizeMonitorEntry).filter(Boolean);
}

const storedEdenaiKey = getSetting('edenai_key') || '';
const storedMonitorUrls = parseMonitorUrls(getSetting('monitor_urls'));

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3001',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
  },
  vikunja: {
    url: (process.env.VIKUNJA_URL || '').replace(/\/+$/, ''),
    token: process.env.VIKUNJA_TOKEN || '',
  },
  edenai: {
    // Management key (starts with "mgmt-eden-…") used to read the account balance.
    // A value stored in the database (settings) overrides the env variable.
    managementKey: storedEdenaiKey || process.env.EDENAI_MANAGEMENT_KEY || '',
  },
  monitor: {
    // List of URLs to probe for reachability.
    // Managed exclusively through the settings (database), not via env vars.
    urls: storedMonitorUrls,
  },
};

export const isProviderConfigured = (provider) => {
  if (provider === 'google') {
    return Boolean(config.google.clientId && config.google.clientSecret);
  }
  return false;
};
