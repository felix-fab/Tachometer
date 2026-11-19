import 'dotenv/config';
import { getSetting } from './db.js';

/** Parse a stored monitor_urls value (JSON array of strings) into a URL list. */
function parseMonitorUrls(raw) {
  if (Array.isArray(raw)) return raw.map((u) => String(u).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((u) => String(u).trim()).filter(Boolean);
    } catch {
      /* fall through to comma-split */
    }
    return raw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
  }
  return [];
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
