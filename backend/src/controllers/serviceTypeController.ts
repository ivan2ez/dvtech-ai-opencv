import { Request, Response, NextFunction } from 'express';
import * as serviceTypeService from '../services/serviceTypeService';

/**
 * GET /api/services — public.
 *
 * Returns only Available services. This is the list the customer's booking
 * dropdown is built from, so an Unavailable service is never offered.
 */
export async function getAllServiceTypes(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const serviceTypes = await serviceTypeService.findAll();
    res.status(200).json(serviceTypes);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/services/manage — admin only.
 *
 * Returns every service, Unavailable ones included, so they can be switched
 * back on from Manage Services.
 */
export async function getAllServiceTypesForAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const serviceTypes = await serviceTypeService.findAll({ includeUnavailable: true });
    res.status(200).json(serviceTypes);
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/services/:id/availability — admin only. */
export async function setServiceTypeAvailability(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      const error = new Error('isAvailable must be a boolean') as Error & {
        statusCode: number;
        errors: Array<{ field: string; message: string }>;
      };
      error.statusCode = 400;
      error.errors = [{ field: 'isAvailable', message: 'isAvailable must be true or false' }];
      throw error;
    }

    const serviceType = await serviceTypeService.setAvailability(id, isAvailable);
    res.status(200).json({
      serviceType,
      message: `Service marked ${isAvailable ? 'Available' : 'Unavailable'}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function getServiceTypeById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const serviceType = await serviceTypeService.findById(id);
    res.status(200).json(serviceType);
  } catch (error) {
    next(error);
  }
}

export async function createServiceType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, description, price, sortWeight } = req.body;
    const serviceType = await serviceTypeService.create({
      name,
      description,
      price,
      sortWeight,
    });
    res.status(201).json(serviceType);
  } catch (error) {
    next(error);
  }
}

export async function updateServiceType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { name, description, price, sortWeight } = req.body;
    const serviceType = await serviceTypeService.update(id, {
      name,
      description,
      price,
      sortWeight,
    });
    res.status(200).json(serviceType);
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/services/:id — archive (soft delete). */
export async function deleteServiceType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await serviceTypeService.remove(id);
    res.status(200).json({ message: 'Service moved to the archive' });
  } catch (error) {
    next(error);
  }
}

/** GET /api/services/archived — admin only. Lists archived services. */
export async function getArchivedServiceTypes(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await serviceTypeService.findArchived();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

/** POST /api/services/:id/restore — admin only. Restores an archived service. */
export async function restoreServiceType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await serviceTypeService.restore(id);
    res.status(200).json({ message: 'Service restored' });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/services/:id/permanent — admin only. Permanently deletes. */
export async function deleteServiceTypePermanently(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await serviceTypeService.permanentlyDelete(id);
    res.status(200).json({ message: 'Service permanently deleted' });
  } catch (error) {
    next(error);
  }
}
