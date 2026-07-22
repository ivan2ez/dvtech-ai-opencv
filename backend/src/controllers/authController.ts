import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import * as authService from '../services/authService';
import { User } from '../models';

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email, password } = req.body;
    const user = await authService.register({ name, email, password });
    res.status(201).json({ user });
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

    const { name, email } = req.body;
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

    user.name = trimmedName;
    user.email = trimmedEmail;
    await user.save();

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    next(error);
  }
}
