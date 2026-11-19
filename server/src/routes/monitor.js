import { Router } from 'express';
import { asyncHandler } from '../util.js';
import {
  getEdenaiBalance,
  getEdenaiUsage,
  edenaiDisplayConfig,
  probeUrls,
} from '../services/monitor.js';

const router = Router();

// GET /api/monitor — EdenAI data + website reachability probes
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const display = edenaiDisplayConfig();

    const balancePromise = display.values.includes('balance')
      ? getEdenaiBalance()
      : Promise.resolve(null);
    const usagePromise =
      display.values.includes('usage') || display.values.includes('calls')
        ? getEdenaiUsage(display.periodDays)
        : Promise.resolve(null);

    const [balance, usage, websites] = await Promise.all([
      balancePromise,
      usagePromise,
      probeUrls(),
    ]);

    const edenai = {};
    if (balance !== null) {
      edenai.balanceData = balance;
    }
    if (usage !== null) {
      edenai.usageData = usage;
    }
    edenai.display = display;

    res.json({
      edenai,
      websites,
      updatedAt: new Date().toISOString(),
    });
  })
);

export default router;
