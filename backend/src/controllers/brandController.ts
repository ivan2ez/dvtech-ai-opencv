import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Op } from 'sequelize';
import { Brand } from '../models';

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/brand-logos');

function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function generateFilename(originalname: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalname).toLowerCase() || '.png';
  return `${timestamp}-${random}${ext}`;
}

/** Removes a brand logo from disk, ignoring a missing file. */
function deleteLogoFile(logoUrl: string | null): void {
  if (!logoUrl) return;
  const filePath = path.resolve(__dirname, '../../', logoUrl.replace(/^\//, ''));
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * GET /api/brands — public.
 *
 * Brands no longer carry a status: a brand either exists or has been archived.
 * The model is paranoid, so archived rows are excluded automatically.
 */
export async function getAllBrands(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const brands = await Brand.findAll({
      order: [['name', 'ASC']],
    });
    res.status(200).json(brands);
  } catch (error) {
    next(error);
  }
}

/** GET /api/brands/archived — admin only. Deleted brands, newest first. */
export async function getArchivedBrands(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const brands = await Brand.findAll({
      where: { deletedAt: { [Op.ne]: null } },
      paranoid: false,
      order: [['deletedAt', 'DESC']],
    });
    res.status(200).json(brands);
  } catch (error) {
    next(error);
  }
}

// POST /api/brands — admin only (multipart: name + optional logo)
export async function createBrand(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ message: 'Brand name is required' });
      return;
    }
    if (name.trim().length > 100) {
      res.status(400).json({ message: 'Brand name must not exceed 100 characters' });
      return;
    }

    // Archived brands keep their name (the unique index still applies), so point
    // the admin at the archive rather than failing with a confusing duplicate.
    const existing = await Brand.findOne({
      where: { name: name.trim() },
      paranoid: false,
    });
    if (existing) {
      res.status(409).json({
        message: existing.deletedAt
          ? 'That brand is in the archive. Restore it instead of creating a new one.'
          : 'Brand already exists',
      });
      return;
    }

    let logoUrl: string | null = null;
    const file = req.file;
    if (file) {
      ensureUploadDir();
      const filename = generateFilename(file.originalname);
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
      logoUrl = `/uploads/brand-logos/${filename}`;
    }

    const brand = await Brand.create({ name: name.trim(), logoUrl, isActive: true });
    res.status(201).json(brand);
  } catch (error) {
    next(error);
  }
}

// PUT /api/brands/:id — admin only (multipart: name + optional logo)
export async function updateBrand(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { name } = req.body;

    const brand = await Brand.findByPk(id);
    if (!brand) {
      res.status(404).json({ message: 'Brand not found' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ message: 'Brand name is required' });
      return;
    }

    const existing = await Brand.findOne({
      where: { name: name.trim() },
      paranoid: false,
    });
    if (existing && existing.id !== id) {
      res.status(409).json({
        message: existing.deletedAt
          ? 'An archived brand already uses that name.'
          : 'Brand name already in use',
      });
      return;
    }

    brand.name = name.trim();

    const file = req.file;
    if (file) {
      deleteLogoFile(brand.logoUrl);
      ensureUploadDir();
      const filename = generateFilename(file.originalname);
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
      brand.logoUrl = `/uploads/brand-logos/${filename}`;
    }

    await brand.save();
    res.status(200).json(brand);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/brands/:id — admin only.
 *
 * Soft delete: the brand moves to the archive, where it can be restored or
 * removed for good. Nothing is lost at this step.
 */
export async function deleteBrand(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    const brand = await Brand.findByPk(id);
    if (!brand) {
      res.status(404).json({ message: 'Brand not found' });
      return;
    }

    await brand.destroy(); // paranoid → sets deleted_at
    res.status(200).json({ message: 'Brand moved to the archive' });
  } catch (error) {
    next(error);
  }
}

/** POST /api/brands/:id/restore — admin only. Returns an archived brand. */
export async function restoreBrand(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    const brand = await Brand.findByPk(id, { paranoid: false });
    if (!brand) {
      res.status(404).json({ message: 'Brand not found' });
      return;
    }
    if (!brand.deletedAt) {
      res.status(409).json({ message: 'That brand is not archived' });
      return;
    }

    await brand.restore();
    res.status(200).json({ message: 'Brand restored' });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/brands/:id/permanent — admin only.
 *
 * Irreversible. Only archived brands qualify, so this is always a deliberate
 * second step. The logo file is removed from disk too.
 *
 * Products store their brand as a plain string, so existing products keep their
 * brand name; the brand simply stops appearing in the picker.
 */
export async function deleteBrandPermanently(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    const brand = await Brand.findByPk(id, { paranoid: false });
    if (!brand) {
      res.status(404).json({ message: 'Brand not found' });
      return;
    }
    if (!brand.deletedAt) {
      res.status(409).json({ message: 'Archive this brand before deleting it permanently' });
      return;
    }

    deleteLogoFile(brand.logoUrl);
    await brand.destroy({ force: true });
    res.status(200).json({ message: 'Brand permanently deleted' });
  } catch (error) {
    next(error);
  }
}
