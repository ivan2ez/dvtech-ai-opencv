import { Request, Response, NextFunction } from 'express';
import * as btuFactorService from '../services/btuFactorService';
import { AuthenticatedRequest } from '../types';

export async function getAllBtuFactors(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const btuFactors = await btuFactorService.findAll();
    res.status(200).json(btuFactors);
  } catch (error) {
    next(error);
  }
}

export async function getBtuFactorById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const btuFactor = await btuFactorService.findById(id);
    res.status(200).json(btuFactor);
  } catch (error) {
    next(error);
  }
}

export async function createBtuFactor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { factorName, factorValue, description } = req.body;
    const userId = (req as AuthenticatedRequest).user!.userId;
    const btuFactor = await btuFactorService.create({ factorName, factorValue, description, userId });
    res.status(201).json(btuFactor);
  } catch (error) {
    next(error);
  }
}

export async function updateBtuFactor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { factorName, factorValue, description } = req.body;
    const btuFactor = await btuFactorService.update(id, { factorName, factorValue, description });
    res.status(200).json(btuFactor);
  } catch (error) {
    next(error);
  }
}

export async function deleteBtuFactor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await btuFactorService.remove(id);
    res.status(200).json({ message: 'BTU factor deleted successfully' });
  } catch (error) {
    next(error);
  }
}
