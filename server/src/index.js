import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import db, { getWidget, upsertWidget } from './db.js';
import authRouter from './routes/auth.js';
import calendarRouter from './routes/calendar.js';
import monitorRouter from './routes/monitor.js';
import settingsRouter from './routes/settings.js';
import vikunjaRouter from './routes/vikunja.js';
import widgetsRouter from './routes/widgets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Seed default widgets
const DEFAULT_WIDGETS = [
  { id: 'clock', slot: 'top-left', config: { showSeconds: false } },
  { id: 'calendar', slot: 'right', config: { maxEvents: 8 } },
  { id: 'vikunja', slot: 'bottom-left', config: {} },
];
for (const w of DEFAULT_WIDGETS) {
  if (!getWidget(w.id)) upsertWidget(w.id, { enabled: true, config: w.config, slot: w.slot });
}

// API routes
app.use('/api/auth', authRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/monitor', monitorRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/vikunja', vikunjaRouter);
app.use('/api/widgets', widgetsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Serve built frontend (production)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  const known = ['google_not_connected', 'vikunja_not_configured'];
  if (known.includes(err.message)) {
    return res.status(502).json({ error: err.message });
  }
  res.status(status).json({ error: err.message || 'Interner Serverfehler.' });
});

app.listen(config.port, () => {
  console.log(`Tachometer Server läuft auf http://localhost:${config.port}`);
});
