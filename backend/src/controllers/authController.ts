import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import * as authService from '../services/authService';
import {
  assertGmailAvailable,
  consumeGmailOtp,
  issueGmailOtp,
  normalizeGmail,
  validateGmail,
} from '../services/verificationService';
import { User } from '../models';

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, password, gmail, gmailOtp } = req.body;
    const result = await authService.register({ name, email, password, gmail, gmailOtp });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/register/gmail-otp
 *
 * Emails a 6-digit code to the Gmail address a visitor entered on the Create
 * Account form. Runs the same uniqueness checks as registration first so a code
 * is never sent for an email/Gmail that could not be registered.
 */
export async function requestRegistrationOtpHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, gmail } = req.body;

    const gmailErrors = validateGmail(gmail);
    if (gmailErrors.length > 0) {
      const error = new Error('Validation failed') as Error & {
        statusCode: number;
        errors: authService.ValidationError[];
      };
      error.statusCode = 400;
      error.errors = gmailErrors;
      throw error;
    }

    await authService.assertRegistrationAvailable(email, gmail);

    const result = await issueGmailOtp({
      gmail,
      purpose: 'registration',
    });

    res.status(200).json({
      message: 'Verification code sent to your Gmail address.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/profile/gmail-otp
 *
 * Emails a verification code to the new Gmail address a signed-in user wants to
 * switch to. The change itself is applied by PUT /api/auth/profile.
 */
export async function requestProfileGmailOtpHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const { gmail } = req.body;

    const gmailErrors = validateGmail(gmail);
    if (gmailErrors.length > 0) {
      const error = new Error('Validation failed') as Error & {
        statusCode: number;
        errors: authService.ValidationError[];
      };
      error.statusCode = 400;
      error.errors = gmailErrors;
      throw error;
    }

    const normalizedGmail = normalizeGmail(gmail);
    await assertGmailAvailable(normalizedGmail, req.user.userId);

    const result = await issueGmailOtp({
      gmail: normalizedGmail,
      purpose: 'profile-update',
      userId: req.user.userId,
    });

    res.status(200).json({
      message: 'Verification code sent to your new Gmail address.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getProfileHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }
    const profile = await authService.getProfile(req.user.userId);
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
}

export async function updateProfileHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const {
      name,
      email,
      street,
      barangay,
      city,
      province,
      contactNumber,
      gmail,
      gmailOtp,
    } = req.body;
    const errors: authService.ValidationError[] = [];

    // Validate name
    if (name === undefined || name === null || String(name).trim().length === 0) {
      errors.push({ field: 'name', message: 'Name is required' });
    } else if (String(name).trim().length < 1) {
      errors.push({ field: 'name', message: 'Name must be at least 1 character' });
    } else if (String(name).trim().length > 100) {
      errors.push({ field: 'name', message: 'Name must not exceed 100 characters' });
    }

    // Validate email
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email === undefined || email === null || String(email).trim().length === 0) {
      errors.push({ field: 'email', message: 'Email is required' });
    } else if (!EMAIL_REGEX.test(String(email).trim())) {
      errors.push({ field: 'email', message: 'Email must be a valid email address' });
    }

    // Gmail is mandatory on the profile, same as at registration.
    errors.push(...validateGmail(gmail));

    if (errors.length > 0) {
      const error = new Error('Validation failed') as Error & {
        statusCode: number;
        errors: authService.ValidationError[];
      };
      error.statusCode = 400;
      error.errors = errors;
      throw error;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();

    // Check duplicate email (excluding current user)
    const existingUser = await User.findOne({ where: { email: trimmedEmail } });
    if (existingUser && existingUser.id !== req.user.userId) {
      const error = new Error('Email already in use') as Error & {
        statusCode: number;
        errors: authService.ValidationError[];
      };
      error.statusCode = 409;
      error.errors = [{ field: 'email', message: 'Email is already registered' }];
      throw error;
    }

    // Update user (ignore role field)
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      const error = new Error('User not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // A Gmail change re-runs the OTP process: the address must be free, and the
    // code emailed to the *new* address must be supplied. Without it the profile
    // is left untouched, so the account cannot be updated unverified.
    const normalizedGmail = normalizeGmail(gmail);
    const gmailChanged = normalizedGmail !== normalizeGmail(user.gmail ?? '');

    if (gmailChanged) {
      await assertGmailAvailable(normalizedGmail, user.id);
      await consumeGmailOtp({
        gmail: normalizedGmail,
        purpose: 'profile-update',
        code: gmailOtp,
        userId: user.id,
      });
      user.gmail = normalizedGmail;
      user.gmailVerifiedAt = new Date();
    }

    user.name = trimmedName;
    user.email = trimmedEmail;

    // Address fields are optional; only update when provided. An explicit empty
    // string clears the field, undefined leaves it unchanged.
    const normalizeAddressPart = (v: unknown): string | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const trimmed = String(v).trim();
      return trimmed.length === 0 ? null : trimmed;
    };
    const streetVal = normalizeAddressPart(street);
    const barangayVal = normalizeAddressPart(barangay);
    const cityVal = normalizeAddressPart(city);
    const provinceVal = normalizeAddressPart(province);
    const contactNumberVal = normalizeAddressPart(contactNumber);
    if (streetVal !== undefined) user.street = streetVal;
    if (barangayVal !== undefined) user.barangay = barangayVal;
    if (cityVal !== undefined) user.city = cityVal;
    if (provinceVal !== undefined) user.province = provinceVal;
    if (contactNumberVal !== undefined) user.contactNumber = contactNumberVal;

    await user.save();

    res.status(200).json(authService.toUserPayload(user));
  } catch (error) {
    next(error);
  }
}

export async function changePasswordHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.userId, { currentPassword, newPassword });

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}

export async function forgotPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body;
    const rawToken = await authService.requestPasswordReset(email);

    // Generic response regardless of whether the account exists (no enumeration).
    const responseBody: {
      message: string;
      resetToken?: string;
      resetUrl?: string;
    } = {
      message:
        'If an account exists for that email, a password reset link has been generated.',
    };

    // No email delivery is configured yet. Outside production, surface the
    // token/link so the reset flow is testable. Wire up an email sender here
    // for production and remove this block.
    if (rawToken && process.env.NODE_ENV !== 'production') {
      const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
      responseBody.resetToken = rawToken;
      responseBody.resetUrl = `${appBaseUrl}/reset-password?token=${rawToken}`;
    }

    res.status(200).json(responseBody);
  } catch (error) {
    next(error);
  }
}

export async function resetPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    next(error);
  }
}
