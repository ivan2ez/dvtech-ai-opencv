import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models';

// --- Types ---

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface RegisteredUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'technician' | 'customer';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'technician' | 'customer';
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'technician' | 'customer';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// --- Constants ---

const BCRYPT_COST_FACTOR = 10;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const JWT_EXPIRATION = '24h';

// --- Account Lockout Tracking ---

interface LockoutEntry {
  failedAttempts: number;
  lockedUntil: Date | null;
}

const loginAttempts: Map<string, LockoutEntry> = new Map();

// --- Validation Helpers ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
const PASSWORD_LOWERCASE_REGEX = /[a-z]/;
const PASSWORD_DIGIT_REGEX = /\d/;

function validateRegistrationInput(input: RegisterInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate name
  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (input.name.trim().length < NAME_MIN_LENGTH) {
    errors.push({
      field: 'name',
      message: `Name must be at least ${NAME_MIN_LENGTH} characters`,
    });
  } else if (input.name.trim().length > NAME_MAX_LENGTH) {
    errors.push({
      field: 'name',
      message: `Name must not exceed ${NAME_MAX_LENGTH} characters`,
    });
  }

  // Validate email
  if (!input.email || input.email.trim().length === 0) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!EMAIL_REGEX.test(input.email.trim())) {
    errors.push({ field: 'email', message: 'Email must be a valid email address' });
  }

  // Validate password
  if (!input.password || input.password.length === 0) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else {
    if (input.password.length < PASSWORD_MIN_LENGTH) {
      errors.push({
        field: 'password',
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      });
    } else if (input.password.length > PASSWORD_MAX_LENGTH) {
      errors.push({
        field: 'password',
        message: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`,
      });
    }

    if (!PASSWORD_UPPERCASE_REGEX.test(input.password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one uppercase letter',
      });
    }

    if (!PASSWORD_LOWERCASE_REGEX.test(input.password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one lowercase letter',
      });
    }

    if (!PASSWORD_DIGIT_REGEX.test(input.password)) {
      errors.push({
        field: 'password',
        message: 'Password must contain at least one digit',
      });
    }
  }

  return errors;
}

// --- Service ---

export async function register(input: RegisterInput): Promise<RegisteredUser> {
  // 1. Validate input
  const validationErrors = validateRegistrationInput(input);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  const trimmedEmail = input.email.trim().toLowerCase();
  const trimmedName = input.name.trim();

  // 2. Check email uniqueness
  const existingUser = await User.findOne({ where: { email: trimmedEmail } });
  if (existingUser) {
    const error = new Error('Email already in use') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 409;
    error.errors = [{ field: 'email', message: 'Email is already registered' }];
    throw error;
  }

  // 3. Hash password with bcrypt (cost factor 10)
  const hashedPassword = await bcrypt.hash(input.password, BCRYPT_COST_FACTOR);

  // 4. Create user with role 'customer' and is_active true
  const user = await User.create({
    name: trimmedName,
    email: trimmedEmail,
    password: hashedPassword,
    role: 'customer',
    isActive: true,
  });

  // 5. Return user data without password
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}


// --- Login ---

export async function login(input: LoginInput): Promise<LoginResult> {
  // 1. Validate that email and password are provided
  if (!input.email || !input.email.trim()) {
    const error = new Error('Invalid credentials') as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }

  if (!input.password) {
    const error = new Error('Invalid credentials') as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }

  const normalizedEmail = input.email.trim().toLowerCase();

  // 2. Check account lockout
  const lockoutEntry = loginAttempts.get(normalizedEmail);
  if (lockoutEntry && lockoutEntry.lockedUntil) {
    if (new Date() < lockoutEntry.lockedUntil) {
      const error = new Error('Account is temporarily locked. Please try again later.') as Error & {
        statusCode: number;
      };
      error.statusCode = 423;
      throw error;
    }
    // Lockout expired, reset
    loginAttempts.delete(normalizedEmail);
  }

  // 3. Look up user by email
  const user = await User.findOne({ where: { email: normalizedEmail } });
  if (!user) {
    recordFailedAttempt(normalizedEmail);
    const error = new Error('Invalid credentials') as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }

  // 4. Check if account is active
  if (!user.isActive) {
    const error = new Error('Account is deactivated') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }

  // 5. Compare password with bcrypt
  const isPasswordValid = await bcrypt.compare(input.password, user.password);
  if (!isPasswordValid) {
    recordFailedAttempt(normalizedEmail);
    const error = new Error('Invalid credentials') as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }

  // 6. Successful login — reset failed attempts
  loginAttempts.delete(normalizedEmail);

  // 7. Generate JWT with user id and role (24h expiry)
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    jwtSecret,
    { expiresIn: JWT_EXPIRATION }
  );

  // 8. Return token and user data (without password)
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

// --- Get Profile ---

export async function getProfile(userId: number): Promise<UserProfile> {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// --- Lockout Helpers ---

function recordFailedAttempt(email: string): void {
  const entry = loginAttempts.get(email) || { failedAttempts: 0, lockedUntil: null };
  entry.failedAttempts += 1;

  if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }

  loginAttempts.set(email, entry);
}

// Exported for testing purposes
export function _resetLoginAttempts(): void {
  loginAttempts.clear();
}

export function _getLoginAttempts(email: string): LockoutEntry | undefined {
  return loginAttempts.get(email);
}
