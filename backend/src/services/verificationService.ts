import crypto from 'crypto';
import { Op } from 'sequelize';
import { EmailVerification, User } from '../models';
import type { VerificationPurpose } from '../models/EmailVerification';
import { sendGmailVerificationCode } from './emailService';

/**
 * Gmail ownership verification via a 6-digit one-time code.
 *
 * Codes are 6 digits, valid for 10 minutes, and are only ever stored as an
 * HMAC-SHA256 digest keyed with a server secret — a plain hash would be
 * trivially reversible for a 6-digit input if the table leaked. Wrong entries
 * are counted and the challenge is burned after 5 failures, and resends are
 * throttled to one per minute.
 */

// --- Constants ---

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute

export const OTP_TTL_MINUTES = CODE_TTL_MS / 60_000;

/** Domains accepted as a "Gmail account". */
const GMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Types ---

export interface ValidationError {
  field: string;
  message: string;
}

export interface IssueOtpInput {
  gmail: string;
  purpose: VerificationPurpose;
  /** Set for profile updates so a code can only be redeemed by its owner. */
  userId?: number | null;
}

export interface IssueOtpResult {
  /** Masked address, safe to echo back to the client (e.g. "ju•••@gmail.com"). */
  maskedGmail: string;
  expiresInMinutes: number;
  /** Seconds the client should wait before offering "Resend" again. */
  resendAvailableInSeconds: number;
  /** False when RESEND_API_KEY is not configured, so the UI can say so. */
  delivered: boolean;
}

export interface ConsumeOtpInput {
  gmail: string;
  purpose: VerificationPurpose;
  code: string;
  userId?: number | null;
}

// --- Error helpers ---

function fieldError(
  statusCode: number,
  message: string,
  errors: ValidationError[]
): Error & { statusCode: number; errors: ValidationError[] } {
  const error = new Error(message) as Error & {
    statusCode: number;
    errors: ValidationError[];
  };
  error.statusCode = statusCode;
  error.errors = errors;
  return error;
}

// --- Gmail helpers ---

/** Lowercases and trims a Gmail address for storage and comparison. */
export function normalizeGmail(value: string): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Validates that the value is a well-formed address on a Gmail domain.
 * Returns field errors (empty when valid) so callers can merge them into their
 * own validation response.
 */
export function validateGmail(value: unknown, field = 'gmail'): ValidationError[] {
  const gmail = normalizeGmail(String(value ?? ''));

  if (gmail.length === 0) {
    return [{ field, message: 'Gmail address is required' }];
  }
  if (gmail.length > 255) {
    return [{ field, message: 'Gmail address must not exceed 255 characters' }];
  }
  if (!EMAIL_REGEX.test(gmail)) {
    return [{ field, message: 'Enter a valid email address' }];
  }

  const domain = gmail.slice(gmail.lastIndexOf('@') + 1);
  if (!GMAIL_DOMAINS.includes(domain)) {
    return [{ field, message: 'Must be a Gmail address (e.g. you@gmail.com)' }];
  }

  return [];
}

/** Masks the local part of an address so it can be shown without exposing it. */
export function maskGmail(gmail: string): string {
  const atIndex = gmail.lastIndexOf('@');
  if (atIndex <= 0) return gmail;

  const local = gmail.slice(0, atIndex);
  const domain = gmail.slice(atIndex);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'•'.repeat(Math.max(3, local.length - visible.length))}${domain}`;
}

/**
 * Rejects a Gmail address already claimed by another account.
 *
 * Archived (soft-deleted) accounts are included in the check: they still own
 * their address and can be restored, so handing it to someone else would create
 * a duplicate. Freeing it requires a permanent delete.
 */
export async function assertGmailAvailable(
  gmail: string,
  excludeUserId?: number | null
): Promise<void> {
  const existing = await User.findOne({
    where: { gmail },
    paranoid: false,
  });

  if (existing && existing.id !== excludeUserId) {
    throw fieldError(409, 'Gmail already in use', [
      { field: 'gmail', message: 'This Gmail address is already linked to another account' },
    ]);
  }
}

// --- Code helpers ---

/** Generates a uniformly random 6-digit numeric code (leading zeros allowed). */
function generateCode(): string {
  const max = 10 ** CODE_LENGTH;
  return String(crypto.randomInt(0, max)).padStart(CODE_LENGTH, '0');
}

/**
 * Keyed digest of a code. The secret makes the stored value useless to an
 * attacker who only has the database.
 */
function hashCode(code: string): string {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('OTP_SECRET or JWT_SECRET must be configured to issue verification codes');
  }
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}

/** Constant-time comparison to avoid leaking the code through timing. */
function digestsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// --- Service ---

/**
 * Issues a fresh OTP for the given Gmail address and emails it.
 *
 * Any earlier live challenge for the same address + purpose is invalidated so
 * only the newest code works. Throttled to one send per minute.
 */
export async function issueGmailOtp(input: IssueOtpInput): Promise<IssueOtpResult> {
  const gmail = normalizeGmail(input.gmail);

  const gmailErrors = validateGmail(gmail);
  if (gmailErrors.length > 0) {
    throw fieldError(400, 'Validation failed', gmailErrors);
  }

  const now = new Date();

  // Throttle: refuse if a code was issued for this address moments ago.
  const recent = await EmailVerification.findOne({
    where: {
      gmail,
      purpose: input.purpose,
      consumedAt: null,
      createdAt: { [Op.gt]: new Date(now.getTime() - RESEND_COOLDOWN_MS) },
    },
    order: [['createdAt', 'DESC']],
  });

  if (recent) {
    const waitMs = RESEND_COOLDOWN_MS - (now.getTime() - recent.createdAt.getTime());
    const waitSeconds = Math.max(1, Math.ceil(waitMs / 1000));
    throw fieldError(429, `Please wait ${waitSeconds} seconds before requesting another code`, [
      { field: 'code', message: `A code was just sent. Try again in ${waitSeconds} seconds.` },
    ]);
  }

  // Supersede any other outstanding challenge for this address + purpose.
  await EmailVerification.destroy({
    where: { gmail, purpose: input.purpose, consumedAt: null },
  });

  const code = generateCode();

  await EmailVerification.create({
    gmail,
    purpose: input.purpose,
    userId: input.userId ?? null,
    codeHash: hashCode(code),
    attempts: 0,
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    verifiedAt: null,
    consumedAt: null,
  });

  const sendResult = await sendGmailVerificationCode(gmail, code, OTP_TTL_MINUTES);

  return {
    maskedGmail: maskGmail(gmail),
    expiresInMinutes: OTP_TTL_MINUTES,
    resendAvailableInSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    delivered: sendResult.delivered,
  };
}

/**
 * Validates a submitted code and marks the challenge consumed in one step, so a
 * single OTP can never authorise two account changes.
 *
 * Throws a 400 with a `gmailOtp` field error on any failure (missing, wrong,
 * expired, or too many attempts).
 */
export async function consumeGmailOtp(input: ConsumeOtpInput): Promise<void> {
  const gmail = normalizeGmail(input.gmail);
  const code = String(input.code ?? '').trim();

  if (code.length === 0) {
    throw fieldError(400, 'Verification code is required', [
      { field: 'gmailOtp', message: 'Enter the 6-digit code sent to your Gmail' },
    ]);
  }

  if (!/^\d{6}$/.test(code)) {
    throw fieldError(400, 'Invalid verification code', [
      { field: 'gmailOtp', message: 'The code must be 6 digits' },
    ]);
  }

  const challenge = await EmailVerification.findOne({
    where: {
      gmail,
      purpose: input.purpose,
      consumedAt: null,
      ...(input.userId ? { userId: input.userId } : {}),
    },
    order: [['createdAt', 'DESC']],
  });

  if (!challenge) {
    throw fieldError(400, 'Invalid or expired verification code', [
      { field: 'gmailOtp', message: 'No active code for this Gmail. Request a new one.' },
    ]);
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    await challenge.destroy();
    throw fieldError(400, 'Invalid or expired verification code', [
      { field: 'gmailOtp', message: 'This code has expired. Request a new one.' },
    ]);
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    await challenge.destroy();
    throw fieldError(400, 'Too many incorrect attempts', [
      { field: 'gmailOtp', message: 'Too many incorrect attempts. Request a new code.' },
    ]);
  }

  if (!digestsMatch(challenge.codeHash, hashCode(code))) {
    challenge.attempts += 1;
    await challenge.save();

    const remaining = MAX_ATTEMPTS - challenge.attempts;
    throw fieldError(400, 'Incorrect verification code', [
      {
        field: 'gmailOtp',
        message:
          remaining > 0
            ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : 'Incorrect code. Request a new one.',
      },
    ]);
  }

  const now = new Date();
  challenge.verifiedAt = now;
  challenge.consumedAt = now;
  await challenge.save();
}

/** Removes expired, unconsumed challenges. Safe to call opportunistically. */
export async function purgeExpiredVerifications(): Promise<number> {
  return EmailVerification.destroy({
    where: {
      consumedAt: null,
      expiresAt: { [Op.lt]: new Date() },
    },
  });
}
