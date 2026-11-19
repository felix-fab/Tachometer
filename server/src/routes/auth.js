import { Router } from 'express';
import crypto from 'node:crypto';
import { config, isProviderConfigured } from '../config.js';
import { getToken, setToken, deleteToken } from '../db.js';
import * as google from '../services/google.js';

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

// Status of providers
router.get('/status', (req, res) => {
  res.json({
    google: {
      configured: isProviderConfigured('google'),
      connected: Boolean(getToken('google')?.access_token),
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

// Disconnect a provider
router.post('/:provider/disconnect', (req, res) => {
  const { provider } = req.params;
  if (provider !== 'google') {
    return res.status(400).json({ error: 'Unbekannter Provider.' });
  }
  deleteToken(provider);
  res.json({ ok: true });
});

export default router;
