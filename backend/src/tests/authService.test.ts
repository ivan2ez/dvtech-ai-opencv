import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { register, login, _resetLoginAttempts, _getLoginAttempts } from '../services/authService';
import { User } from '../models';

// Mock the User model
jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  },
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

const mockedUser = User as jest.Mocked<typeof User>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('authService', () => {
  const now = new Date();

  beforeEach(() => {
    jest.clearAllMocks();
    _resetLoginAttempts();
  });

  // ─── Registration ───────────────────────────────────────────────────

  describe('register', () => {
    const validInput = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password1',
    };

    const createdUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      password: 'hashedpassword',
      role: 'customer' as const,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    describe('input validation', () => {
      it('rejects name shorter than 2 characters', async () => {
        await expect(register({ ...validInput, name: 'A' })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
          ]),
        });
      });

      it('rejects name longer than 100 characters', async () => {
        const longName = 'A'.repeat(101);
        await expect(register({ ...validInput, name: longName })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
          ]),
        });
      });

      it('accepts name between 2 and 100 characters', async () => {
        (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
        (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
        (mockedUser.create as jest.Mock).mockResolvedValue({
          ...createdUser,
          name: 'Jo',
        });

        const result = await register({ ...validInput, name: 'Jo' });
        expect(result.name).toBe('Jo');
      });

      it('rejects invalid email format', async () => {
        await expect(register({ ...validInput, email: 'not-an-email' })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ]),
        });
      });

      it('rejects empty email', async () => {
        await expect(register({ ...validInput, email: '' })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ]),
        });
      });

      it('rejects password shorter than 8 characters', async () => {
        await expect(register({ ...validInput, password: 'Pass1' })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
          ]),
        });
      });

      it('rejects password longer than 128 characters', async () => {
        const longPassword = 'Aa1' + 'x'.repeat(126);
        await expect(register({ ...validInput, password: longPassword })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
          ]),
        });
      });

      it('rejects password without uppercase letter', async () => {
        await expect(register({ ...validInput, password: 'password1' })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'password', message: expect.stringContaining('uppercase') }),
          ]),
        });
      });

      it('rejects password without lowercase letter', async () => {
        await expect(register({ ...validInput, password: 'PASSWORD1' })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'password', message: expect.stringContaining('lowercase') }),
          ]),
        });
      });

      it('rejects password without digit', async () => {
        await expect(register({ ...validInput, password: 'Password' })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'password', message: expect.stringContaining('digit') }),
          ]),
        });
      });

      it('rejects registration with missing name', async () => {
        await expect(register({ ...validInput, name: '' })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
          ]),
        });
      });

      it('rejects registration with missing password', async () => {
        await expect(register({ ...validInput, password: '' })).rejects.toMatchObject({
          statusCode: 400,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
          ]),
        });
      });
    });

    describe('email uniqueness', () => {
      it('rejects registration with duplicate email (409)', async () => {
        (mockedUser.findOne as jest.Mock).mockResolvedValue(createdUser);

        await expect(register(validInput)).rejects.toMatchObject({
          statusCode: 409,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ]),
        });
      });
    });

    describe('password hashing', () => {
      it('hashes password with bcrypt before storing', async () => {
        (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
        (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashed_password_value');
        (mockedUser.create as jest.Mock).mockResolvedValue({
          ...createdUser,
          password: 'hashed_password_value',
        });

        await register(validInput);

        expect(mockedBcrypt.hash).toHaveBeenCalledWith('Password1', 10);
      });
    });

    describe('user creation', () => {
      it('creates user with role customer', async () => {
        (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
        (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
        (mockedUser.create as jest.Mock).mockResolvedValue(createdUser);

        await register(validInput);

        expect(mockedUser.create).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'customer',
            isActive: true,
          })
        );
      });

      it('returns user data without password', async () => {
        (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
        (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
        (mockedUser.create as jest.Mock).mockResolvedValue(createdUser);

        const result = await register(validInput);

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('email');
        expect(result).toHaveProperty('role');
        expect(result).not.toHaveProperty('password');
      });

      it('trims and lowercases email before storing', async () => {
        (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
        (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
        (mockedUser.create as jest.Mock).mockResolvedValue(createdUser);

        await register({ ...validInput, email: '  John@Example.COM  ' });

        expect(mockedUser.create).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'john@example.com',
          })
        );
      });
    });
  });

  // ─── Login ──────────────────────────────────────────────────────────

  describe('login', () => {
    const validLoginInput = {
      email: 'john@example.com',
      password: 'Password1',
    };

    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      password: '$2b$10$hashedpasswordvalue',
      role: 'customer' as const,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret-key';
    });

    afterEach(() => {
      delete process.env.JWT_SECRET;
    });

    it('returns JWT token on valid credentials', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedJwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const result = await login(validLoginInput);

      expect(result).toHaveProperty('token', 'mock-jwt-token');
      expect(result).toHaveProperty('user');
    });

    it('rejects with 401 on wrong password', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(login(validLoginInput)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
      });
    });

    it('rejects with 401 on non-existent email', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);

      await expect(login({ email: 'noone@example.com', password: 'Password1' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid credentials',
      });
    });

    it('rejects with 403 on deactivated account', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      (mockedUser.findOne as jest.Mock).mockResolvedValue(inactiveUser);

      await expect(login(validLoginInput)).rejects.toMatchObject({
        statusCode: 403,
        message: 'Account is deactivated',
      });
    });

    describe('JWT generation', () => {
      it('JWT contains userId and role', async () => {
        (mockedUser.findOne as jest.Mock).mockResolvedValue(mockUser);
        (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
        (mockedJwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

        await login(validLoginInput);

        expect(mockedJwt.sign).toHaveBeenCalledWith(
          { userId: 1, role: 'customer' },
          'test-secret-key',
          { expiresIn: '24h' }
        );
      });

      it('throws error if JWT_SECRET is not configured', async () => {
        delete process.env.JWT_SECRET;
        (mockedUser.findOne as jest.Mock).mockResolvedValue(mockUser);
        (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

        await expect(login(validLoginInput)).rejects.toThrow(
          'JWT_SECRET environment variable is not configured'
        );
      });
    });
  });

  // ─── Account Lockout ────────────────────────────────────────────────

  describe('account lockout', () => {
    const loginInput = {
      email: 'john@example.com',
      password: 'WrongPass1',
    };

    const mockUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      password: '$2b$10$hashedpasswordvalue',
      role: 'customer' as const,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret-key';
    });

    afterEach(() => {
      delete process.env.JWT_SECRET;
    });

    it('locks account after 5 failed attempts', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await expect(login(loginInput)).rejects.toMatchObject({ statusCode: 401 });
      }

      // 6th attempt should be locked (423)
      await expect(login(loginInput)).rejects.toMatchObject({
        statusCode: 423,
      });
    });

    it('returns 423 when account is locked', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Lock the account
      for (let i = 0; i < 5; i++) {
        await expect(login(loginInput)).rejects.toMatchObject({ statusCode: 401 });
      }

      // Subsequent attempts return 423
      await expect(login(loginInput)).rejects.toMatchObject({
        statusCode: 423,
        message: expect.stringContaining('locked'),
      });
    });

    it('resets failed attempts on successful login', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await expect(login(loginInput)).rejects.toMatchObject({ statusCode: 401 });
      }

      // Verify 3 failed attempts recorded
      const entry = _getLoginAttempts('john@example.com');
      expect(entry?.failedAttempts).toBe(3);

      // Successful login
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedJwt.sign as jest.Mock).mockReturnValue('token');
      await login({ email: 'john@example.com', password: 'Password1' });

      // Failed attempts should be reset
      const entryAfter = _getLoginAttempts('john@example.com');
      expect(entryAfter).toBeUndefined();
    });

    it('lockout expires after 15 minutes', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(mockUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Lock the account
      for (let i = 0; i < 5; i++) {
        await expect(login(loginInput)).rejects.toMatchObject({ statusCode: 401 });
      }

      // Verify it's locked
      await expect(login(loginInput)).rejects.toMatchObject({ statusCode: 423 });

      // Simulate time passing (15 minutes + 1ms)
      const entry = _getLoginAttempts('john@example.com');
      if (entry && entry.lockedUntil) {
        entry.lockedUntil = new Date(Date.now() - 1); // Set lockout to the past
      }

      // Should no longer be locked — will try to login and get 401 (wrong password)
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(login(loginInput)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('non-existent user failed attempts are tracked by email', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);

      // Make 5 failed attempts for non-existent user
      for (let i = 0; i < 5; i++) {
        await expect(login({ email: 'noone@example.com', password: 'Wrong1234' }))
          .rejects.toMatchObject({ statusCode: 401 });
      }

      // Should be locked
      await expect(login({ email: 'noone@example.com', password: 'Wrong1234' }))
        .rejects.toMatchObject({ statusCode: 423 });
    });
  });
});
