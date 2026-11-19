import { config } from '../config.js';
import { getSetting } from '../db.js';

const EDENAI_BILLING_URL = 'https://api.edenai.run/v3/manage/billing/';
const EDENAI_USAGE_URL = 'https://api.edenai.run/v3/manage/usage/';

/** Resolve the EdenAI management key at runtime (DB overrides env). */
function edenaiKey() {
  return getSetting('edenai_key') || config.edenai.managementKey || '';
}

/** Resolve the list of monitored URLs at runtime (from the database only). */
function monitorUrls() {
  const stored = getSetting('monitor_urls');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map((u) => String(u).trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  return config.monitor.urls;
}

/**
 * Resolve which EdenAI values should be displayed and over what period.
 * Stored as JSON: { values: ['balance','usage','calls'], periodDays: 30 }.
 */
export function edenaiDisplayConfig() {
  const stored = getSetting('edenai_display');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && Array.isArray(parsed.values)) {
        const values = parsed.values.filter((v) =>
          ['balance', 'usage', 'calls'].includes(v)
        );
        const periodDays = Math.min(366, Math.max(1, Number(parsed.periodDays) || 30));
        return { values, periodDays };
      }
    } catch {
      /* fall through to default */
    }
  }
  // Default: show balance + usage over the last 30 days.
  return { values: ['balance', 'usage'], periodDays: 30 };
}

/** True when an EdenAI management key is configured. */
export function hasEdenaiKey() {
  return Boolean(edenaiKey());
}

/** Format an ISO date as YYYY-MM-DD (for EdenAI's date-window parameters). */
function toDateParam(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Read the EdenAI usage over the last `days` days.
 * Returns { usage (cost), calls } summed across all API keys and days.
 */
export async function getEdenaiUsage(days = 30) {
  const key = edenaiKey();
  if (!key) return null;

  const end = new Date();
  const begin = new Date();
  begin.setDate(begin.getDate() - days);

  try {
    const params = new URLSearchParams({
      begin: toDateParam(begin),
      end: toDateParam(end),
      step: '1', // daily
    });
    const res = await fetch(`${EDENAI_USAGE_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { error: `EdenAI-API: HTTP ${res.status}` };
    }
    const data = await res.json();
    const entries = Array.isArray(data?.usage) ? data.usage : [];

    let totalCost = 0;
    let totalCalls = 0;
    for (const entry of entries) {
      const buckets = entry?.data || {};
      for (const day of Object.values(buckets)) {
        for (const feature of Object.values(day)) {
          totalCost += Number(feature?.total_cost) || 0;
          totalCalls += Number(feature?.details) || 0;
        }
      }
    }
    return { usage: totalCost, calls: totalCalls };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'EdenAI nicht erreichbar.' };
  }
}

/**
 * Read the remaining EdenAI credit balance.
 * Uses the organization management key (scope manage:read).
 * Returns the parsed balance or a descriptive error when unavailable.
 */
export async function getEdenaiBalance() {
  const key = edenaiKey();
  if (!key) {
    return { configured: false, error: 'EDENAI_MANAGEMENT_KEY fehlt.' };
  }

  try {
    const res = await fetch(EDENAI_BILLING_URL, {
      headers: {
        Authorization: `Bearer ${key}`,
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
  const urls = monitorUrls();
  const results = await Promise.all(urls.map((u) => probeUrl(u)));
  return results;
}
