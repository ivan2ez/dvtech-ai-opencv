import { Router } from 'express';
import {
  listMyQuotationsHandler,
  getMyQuotationHandler,
  listAllQuotationsHandler,
  createQuotationHandler,
  updateQuotationStatusHandler,
} from '../controllers/quotationController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import {
  createQuotationValidation,
  updateQuotationStatusValidation,
} from '../utils/validators';

const router = Router();

/**
 * Quotation routes (C4 My Quotations / A6 Manage Quotations — Req 4, 11).
 *
 * Customer routes are scoped to the authenticated user (the handler reads
 * `userId` from the JWT, never from the client — Req 4.7, 4.8). Admin routes
 * are guarded by `roleMiddleware('admin')` so non-admins are denied on the
 * server (Req 11.8).
 *
 * The literal `/mine` paths are declared before the admin root list so they are
 * never captured as a wildcard id.
 */

// ── Customer (My Quotations) ──
// Own quotations, most recent first (Req 4.1, 4.2, 4.4).
router.get('/mine', authMiddleware, roleMiddleware('customer'), listMyQuotationsHandler);
// Details action for a single owned quotation (Req 4.3).
router.get('/mine/:id', authMiddleware, roleMiddleware('customer'), getMyQuotationHandler);

// Create a quotation for a chosen unit (write path — Req 4). Guarded to
// customers; the same path served with GET is the admin listing below. Express
// dispatches by method, so the customer POST and admin GET coexist safely.
router.post(
  '/',
  authMiddleware,
  roleMiddleware('customer'),
  createQuotationValidation,
  handleValidationErrors,
  createQuotationHandler
);

// ── Admin (Manage Quotations) ──
// All customers' quotations, most recent first (Req 11.1, 11.2, 11.3, 11.8).
router.get('/', authMiddleware, roleMiddleware('admin'), listAllQuotationsHandler);

// Admin status transition (Req 11). At 'paid' the service layer wires the
// quotation into "Requests Awaiting Scheduling" (Req 11.5, 11.6).
router.patch(
  '/:id/status',
  authMiddleware,
  roleMiddleware('admin'),
  updateQuotationStatusValidation,
  handleValidationErrors,
  updateQuotationStatusHandler
);

export default router;
