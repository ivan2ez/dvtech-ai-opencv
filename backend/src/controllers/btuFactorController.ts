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

/** DELETE /api/btu-factors/:id — archive (soft delete). */
export async function deleteBtuFactor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await btuFactorService.remove(id);
    res.status(200).json({ message: 'BTU factor moved to the archive' });
  } catch (error) {
    next(error);
  }
}

/** GET /api/btu-factors/archived — list archived BTU factors. */
export async function getArchivedBtuFactors(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await btuFactorService.findArchived();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

/** POST /api/btu-factors/:id/restore — restore an archived BTU factor. */
export async function restoreBtuFactor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await btuFactorService.restore(id);
    res.status(200).json({ message: 'BTU factor restored' });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/btu-factors/:id/permanent — permanently delete an archived factor. */
export async function deleteBtuFactorPermanently(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await btuFactorService.permanentlyDelete(id);
    res.status(200).json({ message: 'BTU factor permanently deleted' });
  } catch (error) {
    next(error);
  }
}
