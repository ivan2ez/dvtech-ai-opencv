import { Op } from 'sequelize';
import { BtuFactor } from '../models';

// --- Types ---

export interface CreateBtuFactorInput {
  factorName: string;
  factorValue: number;
  description?: string | null;
  userId: number;
}

export interface UpdateBtuFactorInput {
  factorName: string;
  factorValue: number;
  description?: string | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

// --- Constants ---

const FACTOR_NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const FACTOR_VALUE_MIN = 0.01;
const FACTOR_VALUE_MAX = 100.0;

// --- Validation ---

function validateBtuFactorInput(input: CreateBtuFactorInput | UpdateBtuFactorInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate factorName
  if (!input.factorName || input.factorName.trim().length === 0) {
    errors.push({ field: 'factorName', message: 'Factor name is required' });
  } else if (input.factorName.trim().length > FACTOR_NAME_MAX_LENGTH) {
    errors.push({ field: 'factorName', message: `Factor name must not exceed ${FACTOR_NAME_MAX_LENGTH} characters` });
  }

  // Validate factorValue
  if (input.factorValue === undefined || input.factorValue === null) {
    errors.push({ field: 'factorValue', message: 'Factor value is required' });
  } else if (typeof input.factorValue !== 'number' || isNaN(input.factorValue)) {
    errors.push({ field: 'factorValue', message: 'Factor value must be a number' });
  } else if (input.factorValue < FACTOR_VALUE_MIN || input.factorValue > FACTOR_VALUE_MAX) {
    errors.push({
      field: 'factorValue',
      message: `Factor value must be between ${FACTOR_VALUE_MIN} and ${FACTOR_VALUE_MAX}`,
    });
  }

  // Validate description (optional)
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' });
    } else if (input.description.length > DESCRIPTION_MAX_LENGTH) {
      errors.push({
        field: 'description',
        message: `Description must not exceed ${DESCRIPTION_MAX_LENGTH} characters`,
      });
    }
  }

  return errors;
}

// --- Service ---

export async function create(input: CreateBtuFactorInput): Promise<BtuFactor> {
  // 1. Validate input
  const validationErrors = validateBtuFactorInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Check uniqueness of factorName
  const existing = await BtuFactor.findOne({ where: { factorName: input.factorName.trim() } });
  if (existing) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = [{ field: 'factorName', message: 'Factor name already exists' }];
    throw error;
  }

  // 3. Create BTU factor
  const btuFactor = await BtuFactor.create({
    factorName: input.factorName.trim(),
    factorValue: input.factorValue,
    description: input.description ?? null,
    userId: input.userId,
  });

  return btuFactor;
}

export async function findAll(): Promise<BtuFactor[]> {
  const btuFactors = await BtuFactor.findAll({
    order: [['factorName', 'ASC']],
  });

  return btuFactors;
}

export async function findById(id: number): Promise<BtuFactor> {
  const btuFactor = await BtuFactor.findByPk(id);
  if (!btuFactor) {
    const error = new Error('BTU factor not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  return btuFactor;
}

export async function update(id: number, input: UpdateBtuFactorInput): Promise<BtuFactor> {
  // 1. Validate input
  const validationErrors = validateBtuFactorInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 2. Find the BTU factor
  const btuFactor = await BtuFactor.findByPk(id);
  if (!btuFactor) {
    const error = new Error('BTU factor not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 3. Check uniqueness of factorName (exclude current record)
  const existing = await BtuFactor.findOne({
    where: {
      factorName: input.factorName.trim(),
      id: { [Op.ne]: id },
    },
  });
  if (existing) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = [{ field: 'factorName', message: 'Factor name already exists' }];
    throw error;
  }

  // 4. Update BTU factor
  await btuFactor.update({
    factorName: input.factorName.trim(),
    factorValue: input.factorValue,
    description: input.description ?? null,
  });

  return btuFactor;
}

export async function remove(id: number): Promise<void> {
  const btuFactor = await BtuFactor.findByPk(id);
  if (!btuFactor) {
    const error = new Error('BTU factor not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  await btuFactor.destroy();
}
