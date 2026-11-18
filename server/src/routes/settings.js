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
];

// Keys that should be returned (and accepted) as booleans.
const BOOLEAN_KEYS = new Set(['clock_24h', 'clock_seconds']);

// GET /api/settings
router.get('/', (req, res) => {
  const result = {};
  for (const key of SETTING_KEYS) {
    const value = getSetting(key);
    if (value === null) continue;
    if (BOOLEAN_KEYS.has(key)) {
      result[key] = value === 'true' || value === true;
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
  for (const [key, value] of Object.entries(allowed)) {
    setSetting(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  res.json({ ok: true, updated: Object.keys(allowed) });
});

export default router;
