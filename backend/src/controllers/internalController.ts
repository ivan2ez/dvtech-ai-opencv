import { Request, Response, NextFunction } from 'express';
import { expireStaleReschedules } from '../services/rescheduleService';

/**
 * Internal, non-user-facing maintenance endpoints.
 *
 * These are invoked by a scheduler (Vercel Cron in production, or a local
 * `setInterval` in `app.ts` when running a long-lived server) rather than by
 * the frontend. They are guarded by a shared secret header so they cannot be
 * triggered from the public internet.
 */

/**
 * Verifies the caller presented the internal-cron secret.
 *
 * Accepts either the `x-internal-secret` header (our own scheduler) or the
 * `Authorization: Bearer <secret>` header (Vercel Cron sends the configured
 * CRON_SECRET this way). If `INTERNAL_CRON_SECRET` is unset the endpoint is
 * refused entirely, so it can never be left unprotected by accident.
 */
function isAuthorizedInternalCaller(req: Request): boolean {
  const expected = process.env.INTERNAL_CRON_SECRET;
  if (!expected || expected.trim().length === 0) {
    return false;
  }

  const headerSecret = req.header('x-internal-secret');
  if (headerSecret && headerSecret === expected) {
    return true;
  }

  const authHeader = req.header('authorization') || '';
  if (authHeader === `Bearer ${expected}`) {
    return true;
  }

  return false;
}

/**
 * POST /api/internal/expire-reschedules
 *
 * Sweeps reschedule proposals whose window has elapsed to `expired`. Invokes
 * the same idempotent `expireStaleReschedules` used by the lazy read paths, so
 * running it repeatedly (e.g. every 30s) affects zero extra rows once a
 * proposal has already expired (Req 10.6, 10.7).
 */
export async function expireReschedulesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isAuthorizedInternalCaller(req)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const expiredCount = await expireStaleReschedules();
    res.status(200).json({ expiredCount });
  } catch (error) {
    next(error);
  }
}
