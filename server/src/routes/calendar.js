import { Router } from 'express';
import { getSetting } from '../db.js';
import { asyncHandler } from '../util.js';
import * as google from '../services/google.js';
import * as microsoft from '../services/microsoft.js';

const router = Router();

function mergeAndSort(events) {
  return events
    .filter((e) => e.start)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

// GET /api/calendar — merged upcoming events from Google + Microsoft
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

    const results = await Promise.allSettled([
      google.getEvents(googleCalendarIds, { maxResults, daysAhead }),
      microsoft.getEvents({ maxResults, daysAhead }),
    ]);

    const googleEvents = results[0].status === 'fulfilled' ? results[0].value : [];
    const microsoftEvents = results[1].status === 'fulfilled' ? results[1].value : [];
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason.message);

    const events = mergeAndSort([...googleEvents, ...microsoftEvents]).slice(0, maxResults);

    res.json({ events, errors });
  })
);

export default router;
