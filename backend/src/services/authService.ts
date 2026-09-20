import crypto from 'crypto';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, PasswordResetToken, LoginAttempt } from '../models';
import {
  assertGmailAvailable,
  consumeGmailOtp,
  normalizeGmail,
  validateGmail,
} from './verificationService';

// --- Types ---

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  /** Gmail address the account is verified against. Mandatory. */
  gmail: string;
  /** 6-digit code emailed to `gmail`. The account is not created without it. */
  gmailOtp: string;
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
    street: string | null;
    barangay: string | null;
    city: string | null;
    province: string | null;
    contactNumber: string | null;
    gmail: string | null;
    gmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

export type UserProfile = LoginResult['user'];

// --- Constants ---

const BCRYPT_COST_FACTOR = 10;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const JWT_EXPIRATION = '24h';

// --- Account Lockout Tracking (persisted in the login_attempts table) ---

interface LockoutEntry {
  failedAttempts: number;
  lockedUntil: Date | null;
}

// --- Validation Helpers ---

/**
 * Emails are case-insensitive identifiers throughout this service.
 *
 * `name@gmail.com` and `NaMe@gmail.com` are the same mailbox, so both must
 * resolve to the same account on login and must collide on registration. The
 * invariant that makes plain equality lookups correct (and index-friendly) is
 * that every write path stores the lowercased form — see `normalizeEmail`.
 * Migration 20240101000034 back-fills rows that predate that rule.
 */
function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

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

  // Validate the Gmail address used for OTP verification and notifications.
  errors.push(...validateGmail(input.gmail));

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

// --- Token / payload helpers ---

/** Signs a 24h JWT for the given user. Throws if JWT_SECRET is not configured. */
function signToken(user: User): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not configured');
  }
  return jwt.sign({ userId: user.id, role: user.role }, jwtSecret, {
    expiresIn: JWT_EXPIRATION,
  });
}

/** Maps a User model to the safe (password-free) shape returned to clients. */
export function toUserPayload(user: User): LoginResult['user'] {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    street: user.street,
    barangay: user.barangay,
    city: user.city,
    province: user.province,
    contactNumber: user.contactNumber,
    gmail: user.gmail,
    gmailVerified: Boolean(user.gmailVerifiedAt),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// --- Service ---

export async function register(input: RegisterInput): Promise<LoginResult> {
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

  const trimmedEmail = normalizeEmail(input.email);
  const trimmedName = input.name.trim();
  const gmail = normalizeGmail(input.gmail);

  // 2. Check email uniqueness. Archived accounts are included: the row still
  // exists and can be restored, so its email is not free to reuse.
  const existingUser = await User.findOne({
    where: { email: trimmedEmail },
    paranoid: false,
  });
  if (existingUser) {
    const error = new Error('Email already in use') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 409;
    error.errors = [{ field: 'email', message: 'Email is already registered' }];
    throw error;
  }

  // 3. The Gmail address must not already be linked to another account.
  await assertGmailAvailable(gmail);

  // 4. Verify the OTP before anything is persisted. This is what makes the
  // account impossible to create without a verified Gmail — it throws a 400
  // with a `gmailOtp` field error when the code is missing, wrong, or expired.
  await consumeGmailOtp({ gmail, purpose: 'registration', code: input.gmailOtp });

  // 5. Hash password with bcrypt (cost factor 10)
  const hashedPassword = await bcrypt.hash(input.password, BCRYPT_COST_FACTOR);

  // 6. Create the verified customer account.
  const user = await User.create({
    name: trimmedName,
    email: trimmedEmail,
    password: hashedPassword,
    role: 'customer',
    isActive: true,
    gmail,
    gmailVerifiedAt: new Date(),
  });

  // 7. Auto-login: return a token and the safe user payload so the client can
  // establish an authenticated session immediately after registration.
  return {
    token: signToken(user),
    user: toUserPayload(user),
  };
}

/**
 * Pre-flight checks before a registration OTP is emailed.
 *
 * Runs the same uniqueness rules as `register` so a code is never sent for an
 * email or Gmail that could not be used anyway.
 */
export async function assertRegistrationAvailable(
  email: string,
  gmail: string
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail.length > 0) {
    const existing = await User.findOne({
      where: { email: normalizedEmail },
      paranoid: false,
    });
    if (existing) {
      const error = new Error('Email already in use') as Error & {
        statusCode: number;
        errors: ValidationError[];
      };
      error.statusCode = 409;
      error.errors = [{ field: 'email', message: 'Email is already registered' }];
      throw error;
    }
  }

  await assertGmailAvailable(normalizeGmail(gmail));
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

  // Same mailbox regardless of the casing typed, so the lookup below matches
  // the account that was registered.
  const normalizedEmail = normalizeEmail(input.email);

  // 2. Check account lockout
  const lockoutEntry = await LoginAttempt.findOne({ where: { email: normalizedEmail } });
  if (lockoutEntry && lockoutEntry.lockedUntil) {
    if (new Date() < lockoutEntry.lockedUntil) {
      const error = new Error('Account is temporarily locked. Please try again later.') as Error & {
        statusCode: number;
      };
      error.statusCode = 423;
      throw error;
    }
    // Lockout expired, reset the record
    await clearFailedAttempts(normalizedEmail);
  }

  // 3. Look up user by email
  const user = await User.findOne({ where: { email: normalizedEmail } });
  if (!user) {
    await recordFailedAttempt(normalizedEmail);
    const error = new Error('Invalid credentials') as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }

  // 4. Deactivated accounts may still sign in (per the revisions) — a
  // deactivated technician just can't be assigned work, enforced separately in
  // the scheduling rules. Only ARCHIVED accounts are barred from logging in,
  // and those are already excluded here: `User.findOne` is paranoid by default,
  // so a soft-deleted row is never returned and the lookup above 401s. No
  // isActive gate is applied.

  // 5. Compare password with bcrypt
  const isPasswordValid = await bcrypt.compare(input.password, user.password);
  if (!isPasswordValid) {
    await recordFailedAttempt(normalizedEmail);
    const error = new Error('Invalid credentials') as Error & { statusCode: number };
    error.statusCode = 401;
    throw error;
  }

  // 6. Successful login — reset failed attempts
  await clearFailedAttempts(normalizedEmail);

  // 7. Return a signed token and the safe user data (without password)
  return {
    token: signToken(user),
    user: toUserPayload(user),
  };
}

// --- Change Password ---

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

function validateNewPassword(password: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!password || password.length === 0) {
    errors.push({ field: 'newPassword', message: 'New password is required' });
    return errors;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push({
      field: 'newPassword',
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    });
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push({
      field: 'newPassword',
      message: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters`,
    });
  }

  if (!PASSWORD_UPPERCASE_REGEX.test(password)) {
    errors.push({ field: 'newPassword', message: 'Password must contain at least one uppercase letter' });
  }
  if (!PASSWORD_LOWERCASE_REGEX.test(password)) {
    errors.push({ field: 'newPassword', message: 'Password must contain at least one lowercase letter' });
  }
  if (!PASSWORD_DIGIT_REGEX.test(password)) {
    errors.push({ field: 'newPassword', message: 'Password must contain at least one digit' });
  }

  return errors;
}

export async function changePassword(
  userId: number,
  input: ChangePasswordInput
): Promise<void> {
  const { currentPassword, newPassword } = input;

  // 1. Validate presence of current password
  if (!currentPassword) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = [{ field: 'currentPassword', message: 'Current password is required' }];
    throw error;
  }

  // 2. Validate the new password against complexity rules
  const validationErrors = validateNewPassword(newPassword);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 3. Load the user
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  // 4. Verify the current password
  const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentValid) {
    const error = new Error('Current password is incorrect') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = [{ field: 'currentPassword', message: 'Current password is incorrect' }];
    throw error;
  }

  // 5. Reject if the new password is the same as the current one
  const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
  if (isSameAsCurrent) {
    const error = new Error('New password must be different from the current password') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = [
      { field: 'newPassword', message: 'New password must be different from the current password' },
    ];
    throw error;
  }

  // 6. Hash and persist the new password
  user.password = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);
  await user.save();
}

// --- Password Reset (token-based) ---

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Request a password reset for the given email.
 *
 * To avoid leaking which emails are registered, this never throws for an
 * unknown/inactive account. When a matching active user exists, a one-time
 * token is generated, its SHA-256 hash is stored with a 1-hour expiry, and any
 * previously issued (unused) tokens for that user are invalidated.
 *
 * Returns the raw token only when a token was actually created (so the caller
 * can build a reset link). In production this should be emailed to the user;
 * the caller decides whether to expose it in the API response.
 */
export async function requestPasswordReset(email: string): Promise<string | null> {
  if (!email || !email.trim()) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ where: { email: normalizedEmail } });

  // Silently succeed for unknown or deactivated accounts (no enumeration).
  if (!user || !user.isActive) {
    return null;
  }

  // Invalidate any prior unused tokens for this user.
  await PasswordResetToken.update(
    { usedAt: new Date() },
    { where: { userId: user.id, usedAt: null } }
  );

  // Generate a cryptographically random token; store only its hash.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);

  await PasswordResetToken.create({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    usedAt: null,
  });

  return rawToken;
}

/**
 * Reset a password using a previously issued token.
 * Validates the token (exists, not used, not expired) and the new password,
 * then updates the user's password and marks the token consumed.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  // 1. Validate token presence
  if (!rawToken || !rawToken.trim()) {
    const error = new Error('Invalid or expired reset token') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate the new password against complexity rules
  const validationErrors = validateNewPassword(newPassword);
  if (validationErrors.length > 0) {
    const error = new Error('Validation failed') as Error & {
      statusCode: number;
      errors: ValidationError[];
    };
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  // 3. Look up the token by its hash
  const tokenHash = hashResetToken(rawToken.trim());
  const resetToken = await PasswordResetToken.findOne({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
  });

  if (!resetToken) {
    const error = new Error('Invalid or expired reset token') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  // 4. Load the target user
  const user = await User.findByPk(resetToken.userId);
  if (!user) {
    const error = new Error('Invalid or expired reset token') as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  // 5. Update password and consume the token
  user.password = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);
  await user.save();

  resetToken.usedAt = new Date();
  await resetToken.save();
}

// --- Get Profile ---

export async function getProfile(userId: number): Promise<UserProfile> {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found') as Error & { statusCode: number };
    error.statusCode = 404;
    throw error;
  }

  return toUserPayload(user);
}

// --- Lockout Helpers (persisted) ---

/**
 * Records a failed login attempt for the email, incrementing the counter and
 * setting a lockout window once the threshold is reached. Upserts the row so
 * the state is shared across processes and survives restarts.
 */
async function recordFailedAttempt(email: string): Promise<void> {
  const existing = await LoginAttempt.findOne({ where: { email } });

  if (!existing) {
    const failedAttempts = 1;
    await LoginAttempt.create({
      email,
      failedAttempts,
      lockedUntil: failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
    });
    return;
  }

  existing.failedAttempts += 1;
  if (existing.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    existing.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }
  await existing.save();
}

/** Clears any lockout record for the email (called on success or expiry). */
async function clearFailedAttempts(email: string): Promise<void> {
  await LoginAttempt.destroy({ where: { email } });
}

// Exported for testing purposes — clears all lockout records.
export async function _resetLoginAttempts(): Promise<void> {
  await LoginAttempt.destroy({ where: {}, truncate: true });
}

export async function _getLoginAttempts(email: string): Promise<LockoutEntry | undefined> {
  const entry = await LoginAttempt.findOne({ where: { email } });
  if (!entry) return undefined;
  return { failedAttempts: entry.failedAttempts, lockedUntil: entry.lockedUntil };
}
