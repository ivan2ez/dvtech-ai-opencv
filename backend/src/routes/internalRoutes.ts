import { Router } from 'express';
import { expireReschedulesHandler } from '../controllers/internalController';

const router = Router();

/**
 * Internal maintenance routes. Not called by the frontend — these are hit by a
 * scheduler (Vercel Cron in production, or the local `setInterval` in app.ts).
 * Each handler self-guards with the INTERNAL_CRON_SECRET, so there is no user
 * auth middleware here.
 */

// Sweep expired reschedule proposals to `expired` (idempotent). Runs on a
// ~30s cadence so a proposal expires within the 60s bound (Req 10.6). POST is
// used by our own scheduler; GET is also accepted because Vercel Cron issues a
// GET (with the CRON_SECRET as a Bearer token, which the handler verifies).
router.post('/expire-reschedules', expireReschedulesHandler);
router.get('/expire-reschedules', expireReschedulesHandler);

export default router;
