import { config } from '../config.js';
import { getToken, setToken } from '../db.js';
import { fetchJson } from '../util.js';

const AUTHORITY = 'https://login.microsoftonline.com';
const GRAPH_URL = 'https://graph.microsoft.com/v1.0';

const SCOPES = ['Calendars.Read', 'offline_access', 'User.Read', 'openid', 'profile'].join(' ');

function redirectUri() {
  return config.microsoft.redirectUri;
}

export function isConfigured() {
  return Boolean(config.microsoft.clientId && config.microsoft.clientSecret);
}

export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.microsoft.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES,
    response_mode: 'query',
    state,
  });
  return `${AUTHORITY}/${config.microsoft.tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: config.microsoft.clientId,
    client_secret: config.microsoft.clientSecret,
    code,
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
    scope: SCOPES,
  });
  return fetchJson(`${AUTHORITY}/${config.microsoft.tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: config.microsoft.clientId,
    client_secret: config.microsoft.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES,
  });
  return fetchJson(`${AUTHORITY}/${config.microsoft.tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

export async function getValidToken() {
  const token = getToken('microsoft');
  if (!token || !token.access_token) return null;
  if (token.expires_at && token.expires_at > Date.now()) {
    return token.access_token;
  }
  if (!token.refresh_token) return null;
  const refreshed = await refreshAccessToken(token.refresh_token);
  setToken('microsoft', {
    access_token: refreshed.access_token,
    refresh_token: token.refresh_token,
    expires_at: Date.now() + (refreshed.expires_in || 3600) * 1000,
  });
  return refreshed.access_token;
}

export async function getEvents({ maxResults = 30, daysAhead = 30 } = {}) {
  const accessToken = await getValidToken();
  if (!accessToken) throw new Error('microsoft_not_connected');

  const startDateTime = new Date().toISOString();
  const endDateTime = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    startDateTime,
    endDateTime,
    $top: String(maxResults),
    $orderby: 'start/dateTime',
    $select: 'id,subject,start,end,location,isAllDay',
  });

  const data = await fetchJson(`${GRAPH_URL}/me/calendar/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return (data.value || []).map((ev) => ({
    id: `microsoft:${ev.id}`,
    source: 'microsoft',
    calendarId: 'primary',
    color: null,
    summary: ev.subject || '(Ohne Titel)',
    location: ev.location?.displayName || null,
    start: ev.start?.dateTime || null,
    end: ev.end?.dateTime || null,
    allDay: Boolean(ev.isAllDay),
  }));
}

export async function getMe() {
  const accessToken = await getValidToken();
  if (!accessToken) throw new Error('microsoft_not_connected');
  return fetchJson(`${GRAPH_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
