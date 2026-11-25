import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';

const router = Router();

// Allowed settings keys
const SETTING_KEYS = [
  'theme',
  'accent',
  'clock_24h',
  'clock_seconds',
  'google_calendars',
  'edenai_key',
  'monitor_urls',
  'edenai_display',
  'auto_rotate_enabled',
  'auto_rotate_seconds',
  'auto_refresh_enabled',
  'auto_refresh_seconds',
];

// Keys that should be returned (and accepted) as booleans.
const BOOLEAN_KEYS = new Set([
  'clock_24h',
  'clock_seconds',
  'auto_rotate_enabled',
  'auto_refresh_enabled',
]);

// Keys that hold secrets; only a masked placeholder is returned to the client.
const SECRET_KEYS = new Set(['edenai_key']);

// Keys that are stored/returned as JSON arrays.
const ARRAY_KEYS = new Set(['monitor_urls']);

// Keys that are stored/returned as JSON objects.
const JSON_KEYS = new Set(['edenai_display']);

/** Mask a secret so only the last 4 chars are visible, e.g. "••••1234". */
function maskSecret(value) {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}

// GET /api/settings
router.get('/', (req, res) => {
  const result = {};
  for (const key of SETTING_KEYS) {
    const value = getSetting(key);
    if (value === null) continue;
    if (BOOLEAN_KEYS.has(key)) {
      result[key] = value === 'true' || value === true;
    } else if (SECRET_KEYS.has(key)) {
      result[key] = maskSecret(value);
    } else if (ARRAY_KEYS.has(key)) {
      try {
        result[key] = Array.isArray(value) ? value : JSON.parse(value);
      } catch {
        result[key] = value ? String(value).split(',').map((s) => s.trim()) : [];
      }
    } else if (JSON_KEYS.has(key)) {
      try {
        result[key] = typeof value === 'object' ? value : JSON.parse(value);
      } catch {
        result[key] = null;
      }
    } else {
      result[key] = value;
    }
  }
  res.json(result);
});

// PUT /api/settings — update one or more settings
router.put('/', (req, res) => {
  const body = req.body || {};
  const allowed = {};
  for (const key of SETTING_KEYS) {
    if (key in body) allowed[key] = body[key];
  }

  // A secret sent as empty (or still fully masked) is treated as "keep current".
  for (const key of SECRET_KEYS) {
    if (key in allowed) {
      const value = allowed[key];
      if (value === '' || (typeof value === 'string' && value.includes('••••'))) {
        delete allowed[key];
      }
    }
  }

  for (const [key, value] of Object.entries(allowed)) {
    if (typeof value === 'string' && !ARRAY_KEYS.has(key)) {
      setSetting(key, value);
    } else {
      setSetting(key, JSON.stringify(value));
    }
  }
  res.json({ ok: true, updated: Object.keys(allowed) });
});

export default router;
