import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3001',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
  },
  microsoft: {
    clientId: process.env.MS_CLIENT_ID || '',
    clientSecret: process.env.MS_CLIENT_SECRET || '',
    redirectUri: process.env.MS_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/callback',
    tenant: process.env.MS_TENANT || 'common',
  },
  vikunja: {
    url: (process.env.VIKUNJA_URL || '').replace(/\/+$/, ''),
    token: process.env.VIKUNJA_TOKEN || '',
  },
  edenai: {
    // Management key (starts with "mgmt-eden-…") used to read the account balance.
    managementKey: process.env.EDENAI_MANAGEMENT_KEY || '',
  },
  monitor: {
    // Comma-separated list of URLs to probe for reachability.
    urls: (process.env.MONITOR_URLS || '')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean),
  },
};

export const isProviderConfigured = (provider) => {
  if (provider === 'google') {
    return Boolean(config.google.clientId && config.google.clientSecret);
  }
  if (provider === 'microsoft') {
    return Boolean(config.microsoft.clientId && config.microsoft.clientSecret);
  }
  return false;
};
