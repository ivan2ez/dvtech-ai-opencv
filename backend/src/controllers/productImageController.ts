import { Response, NextFunction } from 'express';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AuthenticatedRequest } from '../types';
import { AirconProduct, ProductImage } from '../models';

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/product-images');
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

function ensureUploadDir(): void {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function generateFilename(originalname: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalname).toLowerCase() || '.jpg';
  return `${timestamp}-${random}${ext}`;
}

// GET /api/products/:productId/images
export async function listProductImages(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = parseInt(req.params.productId as string, 10);
    const images = await ProductImage.findAll({
      where: { productId },
      order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
    });
    res.status(200).json({ images });
  } catch (error) {
    next(error);
  }
}

// POST /api/products/:productId/images (multipart upload)
export async function uploadProductImages(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = parseInt(req.params.productId as string, 10);

    // Verify product exists
    const product = await AirconProduct.findByPk(productId);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ message: 'No images provided' });
      return;
    }

    // Validate files
    for (const file of files) {
      if (!VALID_MIMETYPES.includes(file.mimetype)) {
        res.status(400).json({ message: `Invalid file type: ${file.originalname}. Only JPEG, PNG, and WebP are allowed.` });
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        res.status(400).json({ message: `File too large: ${file.originalname}. Max size is 5MB.` });
        return;
      }
    }

    ensureUploadDir();

    // Check existing image count
    const existingCount = await ProductImage.count({ where: { productId } });
    const isFirstImage = existingCount === 0;

    // Save files and create records
    const createdImages: ProductImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = generateFilename(file.originalname);
      const filePath = path.join(UPLOAD_DIR, filename);
      fs.writeFileSync(filePath, file.buffer);

      const imageUrl = `/uploads/product-images/${filename}`;
      const image = await ProductImage.create({
        productId,
        imageUrl,
        isCover: isFirstImage && i === 0, // First image of a product becomes cover
        sortOrder: existingCount + i,
      });
      createdImages.push(image);
    }

    // If first image was set as cover, update product's imageUrl
    if (isFirstImage && createdImages.length > 0) {
      product.imageUrl = createdImages[0].imageUrl;
      await product.save();
    }

    res.status(201).json({ images: createdImages });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/products/:productId/images/:imageId/cover
export async function setCoverImage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = parseInt(req.params.productId as string, 10);
    const imageId = parseInt(req.params.imageId as string, 10);

    const image = await ProductImage.findOne({ where: { id: imageId, productId } });
    if (!image) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    // Unset all other covers for this product
    await ProductImage.update({ isCover: false }, { where: { productId } });

    // Set the selected one as cover
    image.isCover = true;
    await image.save();

    // Update product's imageUrl
    const product = await AirconProduct.findByPk(productId);
    if (product) {
      product.imageUrl = image.imageUrl;
      await product.save();
    }

    res.status(200).json({ image, message: 'Cover image updated' });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/products/:productId/images/:imageId
export async function deleteProductImage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = parseInt(req.params.productId as string, 10);
    const imageId = parseInt(req.params.imageId as string, 10);

    const image = await ProductImage.findOne({ where: { id: imageId, productId } });
    if (!image) {
      res.status(404).json({ message: 'Image not found' });
      return;
    }

    const wasCover = image.isCover;

    // Delete the file from disk
    const filePath = path.resolve(__dirname, '../../', image.imageUrl.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await image.destroy();

    // If deleted image was cover, promote another image
    if (wasCover) {
      const nextImage = await ProductImage.findOne({
        where: { productId },
        order: [['sortOrder', 'ASC']],
      });
      if (nextImage) {
        nextImage.isCover = true;
        await nextImage.save();
        const product = await AirconProduct.findByPk(productId);
        if (product) {
          product.imageUrl = nextImage.imageUrl;
          await product.save();
        }
      } else {
        // No more images — clear product imageUrl
        const product = await AirconProduct.findByPk(productId);
        if (product) {
          product.imageUrl = null;
          await product.save();
        }
      }
    }

    res.status(200).json({ message: 'Image deleted' });
  } catch (error) {
    next(error);
  }
}
