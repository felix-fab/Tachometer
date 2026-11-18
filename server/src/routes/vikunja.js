import { Router } from 'express';
import { asyncHandler } from '../util.js';
import * as vikunja from '../services/vikunja.js';

const router = Router();

// GET /api/vikunja — configured status
router.get('/configured', (req, res) => {
  res.json({ configured: vikunja.isConfigured() });
});

// GET /api/vikunja/tasks — the 5 tasks due soonest, filled with undated tasks.
router.get(
  '/tasks',
  asyncHandler(async (req, res) => {
    const max = Math.min(10, Math.max(1, parseInt(req.query.max || '5', 10)));
    const tasks = await vikunja.getTasks();

    // Sort: tasks with a due date first (earliest due first), then tasks without.
    const dated = tasks
      .filter((t) => t.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const undated = tasks.filter((t) => !t.dueDate);

    const selected = [...dated.slice(0, max), ...undated].slice(0, max);

    res.json({ configured: true, tasks: selected });
  })
);

export default router;
