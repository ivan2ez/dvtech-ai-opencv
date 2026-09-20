import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import * as quotationService from '../services/quotationService';

/**
 * Quotation route handlers (C4 My Quotations / A6 Manage Quotations — Req 4, 11).
 *
 * Ownership and access scoping are enforced two ways: the customer handlers
 * pull `userId` from the authenticated JWT (`req.user.userId`), never from a
 * client-provided value (Req 4.7, 4.8), and the admin handler is only reachable
 * through a route guarded by `roleMiddleware('admin')` (Req 11.8). The service
 * layer performs the same checks so a crafted request cannot bypass them.
 */

/**
 * GET /api/quotations/mine (customer)
 *
 * Lists the authenticated customer's own quotations, most recent first
 * (Req 4.1, 4.2, 4.4, 4.7, 4.8).
 */
export async function listMyQuotationsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const quotations = await quotationService.listMyQuotations(req.user.userId);
    res.status(200).json({ quotations });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/quotations/mine/:id (customer)
 *
 * Returns a single quotation the authenticated customer owns, for the details
 * action (Req 4.3). Ownership is enforced server-side: a customer requesting
 * another customer's quotation receives 403.
 */
export async function getMyQuotationHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      const error = new Error('Invalid quotation ID') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const quotation = await quotationService.getOwnedQuotation(id, req.user.userId);
    res.status(200).json({ quotation });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/quotations (customer)
 *
 * Creates a quotation for the authenticated customer from a chosen unit
 * (brand + model + optional details). The `userId` is taken from the JWT
 * (`req.user.userId`), never the client body (Req 4.7, 4.8).
 */
export async function createQuotationHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const { brand, model, details } = req.body;
    const quotation = await quotationService.createQuotation({
      userId: req.user.userId,
      brand,
      model,
      details: details ?? null,
    });

    res.status(201).json({ quotation });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/quotations/:id/status (admin)
 *
 * Moves a quotation to a new status (submitted → under-review → quoted → ... →
 * paid, or declined). Admin-only access is enforced by the route's
 * `roleMiddleware('admin')` (Req 11.8). When the status reaches Paid the
 * service layer wires the quotation into scheduling (Req 11.5, 11.6).
 */
export async function updateQuotationStatusHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      const error = new Error('Invalid quotation ID') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const { status } = req.body;
    const quotation = await quotationService.updateQuotationStatus(id, status);
    res.status(200).json({ quotation });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/quotations (admin)
 *
 * Lists every customer's quotations for the admin Manage Quotations view, most
 * recent first (Req 11.1, 11.2, 11.3). Admin-only access is enforced by the
 * route's `roleMiddleware('admin')` (Req 11.8).
 */
export async function listAllQuotationsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const quotations = await quotationService.listAllQuotations();
    res.status(200).json({ quotations });
  } catch (error) {
    next(error);
  }
}
