import { config } from '../config.js';

const EDENAI_BILLING_URL = 'https://api.edenai.run/v3/manage/billing/';

/** True when an EdenAI management key is configured. */
export function hasEdenaiKey() {
  return Boolean(config.edenai.managementKey);
}

/**
 * Read the remaining EdenAI credit balance.
 * Uses the organization management key (scope manage:read).
 * Returns the parsed balance or a descriptive error when unavailable.
 */
export async function getEdenaiBalance() {
  if (!hasEdenaiKey()) {
    return { configured: false, error: 'EDENAI_MANAGEMENT_KEY fehlt.' };
  }

  try {
    const res = await fetch(EDENAI_BILLING_URL, {
      headers: {
        Authorization: `Bearer ${config.edenai.managementKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return {
        configured: true,
        error: `EdenAI-API: HTTP ${res.status}`,
      };
    }

    const balance = Number(data?.balance);
    return {
      configured: true,
      balance: Number.isFinite(balance) ? balance : null,
      currency: data?.currency || 'USD',
      raw: data,
    };
  } catch (err) {
    return {
      configured: true,
      error: err instanceof Error ? err.message : 'EdenAI nicht erreichbar.',
    };
  }
}

/**
 * Probe a single URL and return its reachability status.
 * A reachable site responds with a 2xx/3xx status; anything else is flagged.
 */
async function probeUrl(url) {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Tachometer-UptimeProbe/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    const latencyMs = Date.now() - startedAt;
    return {
      url,
      reachable: res.ok || res.status < 400,
      status: res.status,
      latencyMs,
    };
  } catch (err) {
    return {
      url,
      reachable: false,
      status: null,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.name || 'Fehler' : 'Fehler',
    };
  }
}

/** Probe all configured URLs (in parallel) and return the results. */
export async function probeUrls() {
  const urls = config.monitor.urls;
  const results = await Promise.all(urls.map((u) => probeUrl(u)));
  return results;
}
