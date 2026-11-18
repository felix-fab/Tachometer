import { Router } from 'express';
import crypto from 'node:crypto';
import { config, isProviderConfigured } from '../config.js';
import { getToken, setToken, deleteToken } from '../db.js';
import * as google from '../services/google.js';
import * as microsoft from '../services/microsoft.js';

const router = Router();

function storeOAuthState(state) {
  const states = JSON.parse(global.__oauthStates || '{}');
  states[state] = Date.now();
  global.__oauthStates = JSON.stringify(states);
}

function isValidOAuthState(state) {
  const states = JSON.parse(global.__oauthStates || '{}');
  if (!states[state]) return false;
  const created = states[state];
  delete states[state];
  global.__oauthStates = JSON.stringify(states);
  return Date.now() - created < 10 * 60 * 1000;
}

// Status of both providers
router.get('/status', (req, res) => {
  res.json({
    google: {
      configured: isProviderConfigured('google'),
      connected: Boolean(getToken('google')?.access_token),
    },
    microsoft: {
      configured: isProviderConfigured('microsoft'),
      connected: Boolean(getToken('microsoft')?.access_token),
    },
  });
});

// Start Google OAuth
router.get('/google/start', (req, res) => {
  if (!isProviderConfigured('google')) {
    return res.status(400).json({ error: 'Google OAuth ist nicht konfiguriert.' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  storeOAuthState(state);
  res.redirect(google.getAuthUrl(state));
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!isValidOAuthState(state)) {
    return res.status(400).send('Ungültiger oder abgelaufener OAuth-State.');
  }
  try {
    const tokens = await google.exchangeCode(code);
    setToken('google', {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      scope: tokens.scope,
    });
    res.redirect(`${config.publicUrl}/settings?connected=google`);
  } catch (err) {
    console.error('google callback error:', err);
    res.status(500).send('Google-Verbindung fehlgeschlagen.');
  }
});

// Start Microsoft OAuth
router.get('/microsoft/start', (req, res) => {
  if (!isProviderConfigured('microsoft')) {
    return res.status(400).json({ error: 'Microsoft OAuth ist nicht konfiguriert.' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  storeOAuthState(state);
  res.redirect(microsoft.getAuthUrl(state));
});

// Microsoft OAuth callback
router.get('/microsoft/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!isValidOAuthState(state)) {
    return res.status(400).send('Ungültiger oder abgelaufener OAuth-State.');
  }
  try {
    const tokens = await microsoft.exchangeCode(code);
    setToken('microsoft', {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      scope: tokens.scope,
    });
    res.redirect(`${config.publicUrl}/settings?connected=microsoft`);
  } catch (err) {
    console.error('microsoft callback error:', err);
    res.status(500).send('Microsoft-Verbindung fehlgeschlagen.');
  }
});

// Disconnect a provider
router.post('/:provider/disconnect', (req, res) => {
  const { provider } = req.params;
  if (provider !== 'google' && provider !== 'microsoft') {
    return res.status(400).json({ error: 'Unbekannter Provider.' });
  }
  deleteToken(provider);
  res.json({ ok: true });
});

export default router;
