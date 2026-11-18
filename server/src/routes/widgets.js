import { Router } from 'express';
import { getWidget, getWidgets, upsertWidget } from '../db.js';

const router = Router();

// GET /api/widgets — all widgets
router.get('/', (req, res) => {
  const widgets = getWidgets().map((w) => ({
    id: w.id,
    enabled: Boolean(w.enabled),
    config: w.config ? JSON.parse(w.config) : {},
    slot: w.slot,
  }));
  res.json(widgets);
});

// GET /api/widgets/:id
router.get('/:id', (req, res) => {
  const w = getWidget(req.params.id);
  if (!w) return res.status(404).json({ error: 'Widget nicht gefunden.' });
  res.json({
    id: w.id,
    enabled: Boolean(w.enabled),
    config: w.config ? JSON.parse(w.config) : {},
    slot: w.slot,
  });
});

// PUT /api/widgets/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { enabled, config, slot } = req.body || {};
  upsertWidget(id, { enabled, config, slot });
  res.json({ ok: true });
});

export default router;
