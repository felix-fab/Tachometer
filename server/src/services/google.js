import { config } from '../config.js';
import { getToken, setToken } from '../db.js';
import { fetchJson } from '../util.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

function redirectUri() {
  return config.google.redirectUri;
}

export function isConfigured() {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(),
  });
  const data = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  return fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

export async function getValidToken() {
  const token = getToken('google');
  if (!token || !token.access_token) return null;
  if (token.expires_at && token.expires_at > Date.now()) {
    return token.access_token;
  }
  if (!token.refresh_token) return null;
  const refreshed = await refreshAccessToken(token.refresh_token);
  setToken('google', {
    access_token: refreshed.access_token,
    refresh_token: token.refresh_token,
    expires_at: Date.now() + (refreshed.expires_in || 3600) * 1000,
  });
  return refreshed.access_token;
}

export async function listCalendars() {
  const accessToken = await getValidToken();
  if (!accessToken) throw new Error('google_not_connected');
  const data = await fetchJson(`${CALENDAR_URL}/users/me/calendarList?maxResults=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (data.items || []).map((c) => ({
    id: c.id,
    summary: c.summary,
    backgroundColor: c.backgroundColor || '#4285f4',
    accessRole: c.accessRole,
  }));
}

/**
 * Fetch the Google event color palette (colorId -> background color).
 * Used to resolve an event's own color, which overrides the calendar color.
 */
export async function getEventColors() {
  const accessToken = await getValidToken();
  if (!accessToken) throw new Error('google_not_connected');
  const data = await fetchJson(`${CALENDAR_URL}/colors`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const map = new Map();
  for (const [id, c] of Object.entries(data.event || {})) {
    map.set(Number(id), c.background || '');
  }
  return map;
}

export async function getEvents(calendarIds = [], { maxResults = 30, daysAhead = 30 } = {}) {
  const accessToken = await getValidToken();
  if (!accessToken) throw new Error('google_not_connected');

  // Build a color map from the calendar list (calendarId -> backgroundColor)
  // and the event color palette (colorId -> background), used to resolve each
  // event's display color.
  const calendars = await listCalendars();
  const colorMap = new Map(calendars.map((c) => [c.id, c.backgroundColor]));
  const eventColors = await getEventColors();

  const ids =
    Array.isArray(calendarIds) && calendarIds.length
      ? calendarIds
      : calendars.map((c) => c.id);

  // Start from the beginning of today (local time) so already-passed events
  // of the current day are still included.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const timeMin = todayStart.toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const all = [];
  for (const id of ids) {
    try {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        maxResults: String(maxResults),
        singleEvents: 'true',
        orderBy: 'startTime',
      });
      const data = await fetchJson(
        `${CALENDAR_URL}/calendars/${encodeURIComponent(id)}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      for (const ev of data.items || []) {
        // An event's own color (colorId) overrides the calendar color.
        const eventColor = ev.colorId != null ? eventColors.get(Number(ev.colorId)) : '';
        all.push({
          id: `google:${ev.id}`,
          source: 'google',
          calendarId: id,
          color: eventColor || colorMap.get(id) || '#4285f4',
          summary: ev.summary || '(Ohne Titel)',
          location: ev.location || null,
          start: ev.start?.dateTime || ev.start?.date || null,
          end: ev.end?.dateTime || ev.end?.date || null,
          allDay: Boolean(ev.start?.date),
        });
      }
    } catch (err) {
      // skip calendars that fail (e.g. no access)
      console.error(`google calendar error for ${id}:`, err.message);
    }
  }
  return all;
}
