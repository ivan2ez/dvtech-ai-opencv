/**
 * Mock Auth Utilities
 *
 * Provides helper functions to create mock user objects and JWT payloads
 * for testing authentication-related functionality.
 */

import { JwtPayload } from '../../types';

interface MockUserData {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'technician' | 'customer';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateMockUserOptions {
  id?: number;
  name?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'technician' | 'customer';
  isActive?: boolean;
}

/**
 * Creates a mock user data object matching the User model shape.
 * Useful for mocking User.findOne, User.create, etc.
 *
 * @param overrides - Optional properties to override defaults
 * @returns A mock user data object
 */
export function createMockUser(overrides: CreateMockUserOptions = {}): MockUserData {
  const now = new Date();
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? 'test@example.com',
    // bcrypt hash for 'password123'
    password: overrides.password ?? '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWX',
    role: overrides.role ?? 'customer',
    isActive: overrides.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates a mock admin user.
 */
export function createMockAdmin(overrides: CreateMockUserOptions = {}): MockUserData {
  return createMockUser({
    id: 100,
    name: 'Admin User',
    email: 'admin@dvtech.com',
    role: 'admin',
    ...overrides,
  });
}

/**
 * Creates a mock technician user.
 */
export function createMockTechnician(overrides: CreateMockUserOptions = {}): MockUserData {
  return createMockUser({
    id: 200,
    name: 'Tech User',
    email: 'tech@dvtech.com',
    role: 'technician',
    ...overrides,
  });
}

/**
 * Creates a mock customer user.
 */
export function createMockCustomer(overrides: CreateMockUserOptions = {}): MockUserData {
  return createMockUser({
    id: 300,
    name: 'Customer User',
    email: 'customer@example.com',
    role: 'customer',
    ...overrides,
  });
}

/**
 * Creates a JWT payload as attached to req.user by authMiddleware.
 *
 * @param overrides - Optional properties to override defaults
 * @returns A JwtPayload object
 */
export function createMockJwtPayload(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    userId: overrides.userId ?? 1,
    role: overrides.role ?? 'customer',
    iat: overrides.iat ?? Math.floor(Date.now() / 1000),
    exp: overrides.exp ?? Math.floor(Date.now() / 1000) + 3600,
  };
}

/**
 * Creates an Authorization header value with a mock JWT token.
 * Useful for integration-style tests or middleware testing.
 *
 * @param token - The token string (defaults to a placeholder)
 * @returns The Authorization header string in "Bearer <token>" format
 */
export function createAuthHeader(token: string = 'mock-jwt-token'): string {
  return `Bearer ${token}`;
}
