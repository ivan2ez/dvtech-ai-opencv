import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import * as adminService from '../services/adminService';

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

export async function deactivateCustomerHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customerId = parseInt(req.params.id as string, 10);

    if (isNaN(customerId)) {
      const error = new Error('Invalid customer ID') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    await adminService.deactivateCustomer(customerId);
    res.status(200).json({ message: 'Customer account deactivated successfully' });
  } catch (error) {
    next(error);
  }
}

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
    const { name, email, password, specialization, contact_number } = req.body;

    if (!name || !email || !password || !specialization || !contact_number) {
      const error = new Error('Missing required fields: name, email, password, specialization, contact_number') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const result = await adminService.createTechnician({
      name,
      email,
      password,
      specialization,
      contactNumber: contact_number,
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

    const { name, specialization, contact_number, availability_status } = req.body;

    await adminService.updateTechnician(technicianId, {
      name,
      specialization,
      contactNumber: contact_number,
      availabilityStatus: availability_status,
    });

    res.status(200).json({ message: 'Technician details updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deactivateTechnicianHandler(
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

    await adminService.deactivateTechnician(technicianId);
    res.status(200).json({ message: 'Technician account deactivated successfully' });
  } catch (error) {
    next(error);
  }
}
