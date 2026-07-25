import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
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

// GET /api/brands — public (list active brands)
export async function getAllBrands(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const brands = await Brand.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
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

    const existing = await Brand.findOne({ where: { name: name.trim() } });
    if (existing) {
      res.status(409).json({ message: 'Brand already exists' });
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

    const existing = await Brand.findOne({ where: { name: name.trim() } });
    if (existing && existing.id !== id) {
      res.status(409).json({ message: 'Brand name already in use' });
      return;
    }

    brand.name = name.trim();

    const file = req.file;
    if (file) {
      // Delete old logo if exists
      if (brand.logoUrl) {
        const oldPath = path.resolve(__dirname, '../../', brand.logoUrl.replace(/^\//, ''));
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
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

// DELETE /api/brands/:id — admin only (soft delete)
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

    brand.isActive = false;
    await brand.save();
    res.status(200).json({ message: 'Brand deactivated' });
  } catch (error) {
    next(error);
  }
}
