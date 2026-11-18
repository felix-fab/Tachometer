import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.join(__dirname, '..', 'data', 'dashboard.db');
const dbPath = process.env.DB_PATH || defaultDbPath;

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS tokens (
    provider TEXT PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    scope TEXT
  );
  CREATE TABLE IF NOT EXISTS widgets (
    id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 1,
    config TEXT DEFAULT '{}',
    slot TEXT
  );
`);

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function getToken(provider) {
  return db.prepare('SELECT * FROM tokens WHERE provider = ?').get(provider) || null;
}

export function setToken(provider, data) {
  db.prepare(
    `INSERT INTO tokens (provider, access_token, refresh_token, expires_at, scope)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       scope = excluded.scope`
  ).run(provider, data.access_token, data.refresh_token || null, data.expires_at || null, data.scope || null);
}

export function deleteToken(provider) {
  db.prepare('DELETE FROM tokens WHERE provider = ?').run(provider);
}

export function getWidget(id) {
  return db.prepare('SELECT * FROM widgets WHERE id = ?').get(id) || null;
}

export function getWidgets() {
  return db.prepare('SELECT * FROM widgets').all();
}

export function upsertWidget(id, { enabled, config, slot }) {
  db.prepare(
    `INSERT INTO widgets (id, enabled, config, slot)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled,
       config = excluded.config,
       slot = excluded.slot`
  ).run(id, enabled === false ? 0 : 1, config ? JSON.stringify(config) : '{}', slot || null);
}

export default db;
