import { Router } from 'express';
import { getSetting } from '../db.js';
import { asyncHandler } from '../util.js';
import * as google from '../services/google.js';

const router = Router();

function mergeAndSort(events) {
  return events
    .filter((e) => e.start)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

// GET /api/calendar — upcoming Google events
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const maxResults = parseInt(req.query.max || '40', 10);
    const daysAhead = parseInt(req.query.days || '30', 10);

    // Which Google calendars to show (from settings)
    let googleCalendarIds = null;
    const rawGoogleIds = getSetting('google_calendars');
    if (rawGoogleIds) {
      try {
        googleCalendarIds = JSON.parse(rawGoogleIds);
      } catch {
        googleCalendarIds = null;
      }
    }

    const googleEvents = await google.getEvents(googleCalendarIds, { maxResults, daysAhead });

    const events = mergeAndSort(googleEvents).slice(0, maxResults);

    res.json({ events, errors: [] });
  })
);

export default router;
