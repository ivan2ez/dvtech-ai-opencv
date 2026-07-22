import { ServiceType } from '../models';

// --- Types ---

export interface CreateServiceTypeInput {
  name: string;
  description: string;
  price: number;
}

export interface UpdateServiceTypeInput {
  name: string;
  description: string;
  price: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

// --- Constants ---

const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MIN_LENGTH = 1;
const DESCRIPTION_MAX_LENGTH = 500;
const PRICE_MIN = 0.01;
const PRICE_MAX = 999999.99;

// --- Validation ---

function validateServiceTypeInput(input: CreateServiceTypeInput | UpdateServiceTypeInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate name
  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (input.name.trim().length < NAME_MIN_LENGTH) {
    errors.push({ field: 'name', message: `Name must be at least ${NAME_MIN_LENGTH} character` });
  } else if (input.name.trim().length > NAME_MAX_LENGTH) {
    errors.push({ field: 'name', message: `Name must not exceed ${NAME_MAX_LENGTH} characters` });
  }

  // Validate description
  if (!input.description || input.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Description is required' });
  } else if (input.description.trim().length < DESCRIPTION_MIN_LENGTH) {
    errors.push({ field: 'description', message: `Description must be at least ${DESCRIPTION_MIN_LENGTH} character` });
  } else if (input.description.trim().length > DESCRIPTION_MAX_LENGTH) {
    errors.push({ field: 'description', message: `Description must not exceed ${DESCRIPTION_MAX_LENGTH} characters` });
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

  return errors;
}

// --- Service ---

export async function create(input: CreateServiceTypeInput): Promise<ServiceType> {
  // 1. Validate input
  const validationErrors = validateServiceTypeInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Create service type with isActive = true
  const serviceType = await ServiceType.create({
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
    isActive: true,
  });

  return serviceType;
}

export async function findAll(): Promise<ServiceType[]> {
  const serviceTypes = await ServiceType.findAll({
    where: { isActive: true },
    order: [['name', 'ASC']],
  });

  return serviceTypes;
}

export async function findById(id: number): Promise<ServiceType> {
  const serviceType = await ServiceType.findByPk(id);
  if (!serviceType) {
    const error = new Error('Service type not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  return serviceType;
}

export async function update(id: number, input: UpdateServiceTypeInput): Promise<ServiceType> {
  // 1. Validate input
  const validationErrors = validateServiceTypeInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Find the service type
  const serviceType = await ServiceType.findByPk(id);
  if (!serviceType) {
    const error = new Error('Service type not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 3. Update service type
  await serviceType.update({
    name: input.name.trim(),
    description: input.description.trim(),
    price: input.price,
  });

  return serviceType;
}

export async function deactivate(id: number): Promise<ServiceType> {
  const serviceType = await ServiceType.findByPk(id);
  if (!serviceType) {
    const error = new Error('Service type not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  await serviceType.update({ isActive: false });

  return serviceType;
}
