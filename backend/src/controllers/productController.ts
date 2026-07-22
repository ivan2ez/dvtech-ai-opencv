import { Request, Response, NextFunction } from 'express';
import * as productService from '../services/productService';

export async function getAllProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
    const type = req.query.type as string | undefined;
    const sortByPrice = req.query.sortByPrice as 'asc' | 'desc' | undefined;

    const result = await productService.findAll({ page, pageSize, type, sortByPrice });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getProductById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const product = await productService.findById(id);
    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
}

export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { brand, model, type, horsepower, btuCapacity, price, description, imageUrl } = req.body;
    const product = await productService.create({
      brand,
      model,
      type,
      horsepower,
      btuCapacity,
      price,
      description,
      imageUrl,
    });
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
}

export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { brand, model, type, horsepower, btuCapacity, price, description, imageUrl } = req.body;
    const product = await productService.update(id, {
      brand,
      model,
      type,
      horsepower,
      btuCapacity,
      price,
      description,
      imageUrl,
    });
    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
}

export async function deleteProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await productService.deactivate(id);
    res.status(200).json({ message: 'Product deactivated successfully' });
  } catch (error) {
    next(error);
  }
}
