import { Op } from 'sequelize';
import { AirconProduct } from '../models';

// --- Types ---

export interface CreateProductInput {
  brand: string;
  model: string;
  type: string;
  horsepower: number;
  btuCapacity: number;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
}

export interface UpdateProductInput {
  brand: string;
  model: string;
  type: string;
  horsepower: number;
  btuCapacity: number;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
}

export interface FindAllOptions {
  page?: number;
  pageSize?: number;
  type?: string;
  sortByPrice?: 'asc' | 'desc';
  includeInactive?: boolean;
}

export interface PaginatedResult {
  data: AirconProduct[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

// --- Constants ---

const VALID_TYPES = ['split-type', 'window-type', 'floor-standing'];
const BRAND_MAX_LENGTH = 100;
const MODEL_MAX_LENGTH = 100;
const IMAGE_URL_MAX_LENGTH = 500;
const HORSEPOWER_MIN = 0.5;
const HORSEPOWER_MAX = 10;
const BTU_CAPACITY_MIN = 5000;
const BTU_CAPACITY_MAX = 60000;
const PRICE_MIN = 0.01;
const PRICE_MAX = 999999.99;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 20;

// --- Validation ---

function validateProductInput(input: CreateProductInput | UpdateProductInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate brand
  if (!input.brand || input.brand.trim().length === 0) {
    errors.push({ field: 'brand', message: 'Brand is required' });
  } else if (input.brand.trim().length > BRAND_MAX_LENGTH) {
    errors.push({ field: 'brand', message: `Brand must not exceed ${BRAND_MAX_LENGTH} characters` });
  }

  // Validate model
  if (!input.model || input.model.trim().length === 0) {
    errors.push({ field: 'model', message: 'Model is required' });
  } else if (input.model.trim().length > MODEL_MAX_LENGTH) {
    errors.push({ field: 'model', message: `Model must not exceed ${MODEL_MAX_LENGTH} characters` });
  }

  // Validate type
  if (!input.type || input.type.trim().length === 0) {
    errors.push({ field: 'type', message: 'Type is required' });
  } else if (!VALID_TYPES.includes(input.type.trim())) {
    errors.push({
      field: 'type',
      message: `Type must be one of: ${VALID_TYPES.join(', ')}`,
    });
  }

  // Validate horsepower
  if (input.horsepower === undefined || input.horsepower === null) {
    errors.push({ field: 'horsepower', message: 'Horsepower is required' });
  } else if (typeof input.horsepower !== 'number' || isNaN(input.horsepower)) {
    errors.push({ field: 'horsepower', message: 'Horsepower must be a number' });
  } else if (input.horsepower < HORSEPOWER_MIN || input.horsepower > HORSEPOWER_MAX) {
    errors.push({
      field: 'horsepower',
      message: `Horsepower must be between ${HORSEPOWER_MIN} and ${HORSEPOWER_MAX}`,
    });
  }

  // Validate btuCapacity
  if (input.btuCapacity === undefined || input.btuCapacity === null) {
    errors.push({ field: 'btuCapacity', message: 'BTU capacity is required' });
  } else if (typeof input.btuCapacity !== 'number' || isNaN(input.btuCapacity)) {
    errors.push({ field: 'btuCapacity', message: 'BTU capacity must be a number' });
  } else if (!Number.isInteger(input.btuCapacity)) {
    errors.push({ field: 'btuCapacity', message: 'BTU capacity must be an integer' });
  } else if (input.btuCapacity < BTU_CAPACITY_MIN || input.btuCapacity > BTU_CAPACITY_MAX) {
    errors.push({
      field: 'btuCapacity',
      message: `BTU capacity must be between ${BTU_CAPACITY_MIN} and ${BTU_CAPACITY_MAX}`,
    });
  }

  // Validate price
  if (input.price === undefined || input.price === null) {
    errors.push({ field: 'price', message: 'Price is required' });
  } else if (typeof input.price !== 'number' || isNaN(input.price)) {
    errors.push({ field: 'price', message: 'Price must be a number' });
  } else if (input.price < PRICE_MIN || input.price > PRICE_MAX) {
    errors.push({
      field: 'price',
      message: `Price must be between ${PRICE_MIN} and ${PRICE_MAX}`,
    });
  }

  // Validate imageUrl (optional)
  if (input.imageUrl !== undefined && input.imageUrl !== null) {
    if (typeof input.imageUrl !== 'string') {
      errors.push({ field: 'imageUrl', message: 'Image URL must be a string' });
    } else if (input.imageUrl.length > IMAGE_URL_MAX_LENGTH) {
      errors.push({
        field: 'imageUrl',
        message: `Image URL must not exceed ${IMAGE_URL_MAX_LENGTH} characters`,
      });
    }
  }

  return errors;
}

// --- Service ---

export async function create(input: CreateProductInput): Promise<AirconProduct> {
  // 1. Validate input
  const validationErrors = validateProductInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Create product with is_active = true
  const product = await AirconProduct.create({
    brand: input.brand.trim(),
    model: input.model.trim(),
    type: input.type.trim(),
    horsepower: input.horsepower,
    btuCapacity: input.btuCapacity,
    price: input.price,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    isActive: true,
  });

  return product;
}

export async function findAll(options?: FindAllOptions): Promise<PaginatedResult> {
  const page = options?.page ?? DEFAULT_PAGE;
  const pageSize = Math.min(options?.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;

  // Build where clause
  const where: Record<string, unknown> = {};

  // Only return active products by default
  if (!options?.includeInactive) {
    where.isActive = true;
  }

  // Filter by type
  if (options?.type) {
    where.type = options.type;
  }

  // Build order clause
  const order: [string, string][] = [];
  if (options?.sortByPrice) {
    order.push(['price', options.sortByPrice.toUpperCase()]);
  }

  const { rows, count } = await AirconProduct.findAndCountAll({
    where,
    order: order.length > 0 ? order : undefined,
    limit: pageSize,
    offset,
  });

  return {
    data: rows,
    pagination: {
      page,
      pageSize,
      totalItems: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

export async function findById(id: number): Promise<AirconProduct> {
  const product = await AirconProduct.findByPk(id);
  if (!product) {
    const error = new Error('Product not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  return product;
}

export async function update(id: number, input: UpdateProductInput): Promise<AirconProduct> {
  // 1. Validate input
  const validationErrors = validateProductInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Find the product
  const product = await AirconProduct.findByPk(id);
  if (!product) {
    const error = new Error('Product not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 3. Update product
  await product.update({
    brand: input.brand.trim(),
    model: input.model.trim(),
    type: input.type.trim(),
    horsepower: input.horsepower,
    btuCapacity: input.btuCapacity,
    price: input.price,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
  });

  return product;
}

export async function deactivate(id: number): Promise<AirconProduct> {
  const product = await AirconProduct.findByPk(id);
  if (!product) {
    const error = new Error('Product not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  await product.update({ isActive: false });

  return product;
}
