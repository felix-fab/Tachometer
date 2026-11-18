import { Router } from 'express';
import { asyncHandler } from '../util.js';
import { getEdenaiBalance, probeUrls } from '../services/monitor.js';

const router = Router();

// GET /api/monitor — EdenAI balance + website reachability probes
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [edenai, websites] = await Promise.all([
      getEdenaiBalance(),
      probeUrls(),
    ]);
    res.json({
      edenai,
      websites,
      updatedAt: new Date().toISOString(),
    });
  })
);

export default router;
