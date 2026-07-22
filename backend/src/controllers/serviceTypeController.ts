import { Request, Response, NextFunction } from 'express';
import * as serviceTypeService from '../services/serviceTypeService';

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
    const { name, description, price } = req.body;
    const serviceType = await serviceTypeService.create({
      name,
      description,
      price,
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
    const { name, description, price } = req.body;
    const serviceType = await serviceTypeService.update(id, {
      name,
      description,
      price,
    });
    res.status(200).json(serviceType);
  } catch (error) {
    next(error);
  }
}

export async function deleteServiceType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await serviceTypeService.deactivate(id);
    res.status(200).json({ message: 'Service type deactivated successfully' });
  } catch (error) {
    next(error);
  }
}
