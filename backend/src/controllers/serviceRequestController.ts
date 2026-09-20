import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import * as serviceRequestService from '../services/serviceRequestService';
import * as rescheduleService from '../services/rescheduleService';

export async function createServiceRequestHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const {
      serviceType,
      acDetails,
      serviceStreet,
      serviceBarangay,
      serviceCity,
      serviceProvince,
      contactNumber,
      installBrand,
      installModel,
      serviceRequiredDate,
      serviceRequiredTime,
    } = req.body;
    const serviceRequest = await serviceRequestService.createServiceRequest(
      {
        serviceType,
        acDetails,
        serviceStreet,
        serviceBarangay,
        serviceCity,
        serviceProvince,
        contactNumber,
        installBrand,
        installModel,
        serviceRequiredDate,
        serviceRequiredTime,
      },
      req.user.userId
    );

    res.status(201).json({ serviceRequest });
  } catch (error) {
    next(error);
  }
}

export async function listServiceRequestsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;
    // Customer recycle-bin scope: ?scope=deleted returns the customer's bin.
    const scope = req.query.scope === 'deleted' ? 'deleted' : 'active';

    const result = await serviceRequestService.listServiceRequests({
      userId: req.user.userId,
      role: req.user.role,
      page,
      pageSize,
      scope,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/service-requests/awaiting-scheduling (admin)
 *
 * Returns the approved, still-unscheduled requests that are ready for the admin
 * to assign, applying the quotation Paid-gate: a quotation-based request only
 * appears once its quotation reaches 'paid' (Req 11.5, 11.6). Non-quotation
 * requests are unaffected and appear as soon as they are approved (Req 11.7).
 */
export async function listAwaitingSchedulingHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }
    const data = await serviceRequestService.listRequestsAwaitingScheduling();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

// ── Admin archive (distinct from the customer's own recycle bin) ──

/** GET /api/service-requests/archived (admin) — list archived requests. */
export async function listArchivedServiceRequestsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }
    const data = await serviceRequestService.findArchivedServiceRequests();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/service-requests/:id/archive (admin) — archive (soft delete). */
export async function archiveServiceRequestHandler(
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
    await serviceRequestService.archiveServiceRequest(id);
    res.status(200).json({ message: 'Service request moved to the archive' });
  } catch (error) {
    next(error);
  }
}

/** POST /api/service-requests/:id/admin-restore (admin) — restore archived. */
export async function restoreServiceRequestHandler(
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
    await serviceRequestService.restoreServiceRequest(id);
    res.status(200).json({ message: 'Service request restored' });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/service-requests/:id/admin-permanent (admin) — permanent delete. */
export async function permanentlyDeleteServiceRequestHandler(
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
    await serviceRequestService.permanentlyDeleteServiceRequest(id);
    res.status(200).json({ message: 'Service request permanently deleted' });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/service-requests/:id (customer) — move to the customer's recycle bin. */
export async function softDeleteOwnRequestHandler(
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
    await serviceRequestService.softDeleteOwnRequest(id, req.user.userId);
    res.status(200).json({ message: 'Request moved to your recycle bin.' });
  } catch (error) {
    next(error);
  }
}

/** POST /api/service-requests/:id/restore (customer) — restore from the recycle bin. */
export async function restoreOwnRequestHandler(
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
    await serviceRequestService.restoreOwnRequest(id, req.user.userId);
    res.status(200).json({ message: 'Request restored.' });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/service-requests/:id/permanent (customer) — delete for good from the bin. */
export async function permanentlyDeleteOwnRequestHandler(
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
    await serviceRequestService.permanentlyDeleteOwnRequest(id, req.user.userId);
    res.status(200).json({ message: 'Request permanently deleted.' });
  } catch (error) {
    next(error);
  }
}

export async function getServiceRequestByIdHandler(
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
    const serviceRequest = await serviceRequestService.getServiceRequestById(
      id,
      req.user.userId,
      req.user.role
    );

    res.status(200).json({ serviceRequest });
  } catch (error) {
    next(error);
  }
}

export async function approveServiceRequestHandler(
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
    const serviceRequest = await serviceRequestService.approveServiceRequest(
      id,
      req.user.role
    );

    res.status(200).json({ serviceRequest, message: 'Service request approved successfully' });
  } catch (error) {
    next(error);
  }
}

export async function rejectServiceRequestHandler(
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
    const { reason } = req.body;
    const serviceRequest = await serviceRequestService.rejectServiceRequest(
      id,
      req.user.role,
      reason
    );

    res.status(200).json({ serviceRequest, message: 'Service request rejected successfully' });
  } catch (error) {
    next(error);
  }
}

// ─── Rescheduling ──────────────────────────────────────────────────────────────

/**
 * PATCH /api/service-requests/:id/reschedule (admin)
 *
 * Proposes a new schedule when no technician is available on the customer's
 * chosen slot. Moves the request to `needs-rescheduling` and emails the
 * customer an action link with a 48-hour deadline.
 */
export async function proposeRescheduleHandler(
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
    if (isNaN(id)) {
      const error = new Error('Invalid service request ID') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const { proposedDate, proposedTime, proposedTechnicianId, reason } = req.body;

    const result = await rescheduleService.proposeReschedule({
      serviceRequestId: id,
      proposedDate,
      proposedTime,
      proposedTechnicianId:
        proposedTechnicianId === undefined || proposedTechnicianId === null || proposedTechnicianId === ''
          ? null
          : Number(proposedTechnicianId),
      reason,
    });

    res.status(200).json({
      serviceRequest: result.serviceRequest,
      emailDelivered: result.emailDelivered,
      expiresAt: result.expiresAt,
      message: result.emailDelivered
        ? 'Reschedule proposed. The customer has been emailed and has 48 hours to respond.'
        : 'Reschedule proposed, but the notification email could not be sent. The customer will still see it in their portal.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/service-requests/:id/reschedule/respond (customer)
 *
 * Accepts (→ assigned) or declines (→ declined, with optional notes) a proposed
 * schedule. Rejected with 410 once the 48-hour window has passed.
 */
export async function respondToRescheduleHandler(
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
    if (isNaN(id)) {
      const error = new Error('Invalid service request ID') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const { action, notes } = req.body;

    const serviceRequest = await rescheduleService.respondToReschedule({
      serviceRequestId: id,
      userId: req.user.userId,
      action,
      notes,
    });

    res.status(200).json({
      serviceRequest,
      message:
        action === 'accept'
          ? 'New schedule accepted. Your request is now assigned.'
          : 'New schedule declined.',
    });
  } catch (error) {
    next(error);
  }
}
