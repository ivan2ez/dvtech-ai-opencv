import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import * as adminService from '../services/adminService';

export async function getDashboardStatsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await adminService.getDashboardStats();
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
}

export async function getCustomersHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(
      20,
      Math.max(1, parseInt(req.query.pageSize as string, 10) || 20)
    );

    const result = await adminService.getCustomers(page, pageSize);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Parses and validates an `:id` route param.
 *
 * Express types param values as `string | string[]`, so the value is narrowed
 * before parsing rather than cast.
 */
function parseAccountId(raw: unknown, label: string): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = typeof value === 'string' || typeof value === 'number' ? parseInt(String(value), 10) : NaN;

  if (Number.isNaN(id)) {
    const error = new Error(`Invalid ${label} ID`) as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }
  return id;
}

/**
 * Builds the handler set for one account role, so customers and technicians
 * share a single implementation of the activate/archive/restore/purge flow.
 */
function accountHandlers(role: adminService.AccountRole) {
  const label = role === 'customer' ? 'Customer' : 'Technician';

  return {
    /** PATCH /:id/status — the Activate/Deactivate toggle. */
    setStatus: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseAccountId(req.params.id, role);
        const { isActive, durationDays } = req.body;

        if (typeof isActive !== 'boolean') {
          const error = new Error('isActive must be a boolean') as Error & {
            statusCode: number;
            errors: Array<{ field: string; message: string }>;
          };
          error.statusCode = 400;
          error.errors = [{ field: 'isActive', message: 'isActive must be true or false' }];
          throw error;
        }

        // durationDays is optional and only meaningful when deactivating; the
        // service validates the allowed values. Coerce a numeric string to a
        // number and treat missing/empty as "forever" (null).
        const parsedDuration =
          durationDays === undefined || durationDays === null || durationDays === ''
            ? null
            : Number(durationDays);

        // Pass the authenticated actor so the service can enforce the
        // admin-only activation rule server-side (Req 12.6).
        const actor = req.user
          ? { userId: req.user.userId, role: req.user.role }
          : undefined;

        await adminService.setAccountActive(id, role, isActive, parsedDuration, actor);
        res.status(200).json({
          message: `${label} account ${isActive ? 'activated' : 'deactivated'} successfully`,
        });
      } catch (error) {
        next(error);
      }
    },

    /** DELETE /:id — soft delete into the archive. */
    archive: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseAccountId(req.params.id, role);
        await adminService.archiveAccount(id, role);
        res.status(200).json({ message: `${label} account moved to the archive` });
      } catch (error) {
        next(error);
      }
    },

    /** GET /archived — the archive listing. */
    listArchived: async (
      _req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const data = await adminService.getArchivedAccounts(role);
        res.status(200).json({ data });
      } catch (error) {
        next(error);
      }
    },

    /** POST /:id/restore — bring an archived account back. */
    restore: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseAccountId(req.params.id, role);
        await adminService.restoreAccount(id, role);
        res.status(200).json({ message: `${label} account restored successfully` });
      } catch (error) {
        next(error);
      }
    },

    /** GET /:id/deletion-impact — what a permanent delete would remove. */
    deletionImpact: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseAccountId(req.params.id, role);
        const impact = await adminService.getAccountDeletionImpact(id, role);
        res.status(200).json(impact);
      } catch (error) {
        next(error);
      }
    },

    /** DELETE /:id/permanent — irreversible hard delete. */
    purge: async (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = parseAccountId(req.params.id, role);
        await adminService.deleteAccountPermanently(id, role);
        res.status(200).json({ message: `${label} account permanently deleted` });
      } catch (error) {
        next(error);
      }
    },
  };
}

export const customerAccountHandlers = accountHandlers('customer');
export const technicianAccountHandlers = accountHandlers('technician');

export async function getTechniciansHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const technicians = await adminService.getTechnicians();
    res.status(200).json({ data: technicians });
  } catch (error) {
    next(error);
  }
}

export async function createTechnicianHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, password, specialization, contactNumber, street, barangay, city, province } = req.body;

    if (!name || !email || !password || !specialization || !contactNumber) {
      const error = new Error('Missing required fields: name, email, password, specialization, contactNumber') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const result = await adminService.createTechnician({
      name,
      email,
      password,
      specialization,
      contactNumber,
      street,
      barangay,
      city,
      province,
    });

    res.status(201).json({
      message: 'Technician account created successfully',
      data: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        technicianDetail: {
          id: result.technicianDetail.id,
          specialization: result.technicianDetail.specialization,
          contactNumber: result.technicianDetail.contactNumber,
          availabilityStatus: result.technicianDetail.availabilityStatus,
          street: result.technicianDetail.street,
          barangay: result.technicianDetail.barangay,
          city: result.technicianDetail.city,
          province: result.technicianDetail.province,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTechnicianHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const technicianId = parseInt(req.params.id as string, 10);

    if (isNaN(technicianId)) {
      const error = new Error('Invalid technician ID') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const { name, email, specialization, contactNumber, availabilityStatus, street, barangay, city, province } = req.body;

    await adminService.updateTechnician(technicianId, {
      name,
      email,
      specialization,
      contactNumber,
      availabilityStatus,
      street,
      barangay,
      city,
      province,
    });

    res.status(200).json({ message: 'Technician details updated successfully' });
  } catch (error) {
    next(error);
  }
}


