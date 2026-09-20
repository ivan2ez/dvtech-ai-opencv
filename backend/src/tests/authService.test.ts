import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { register, login, _resetLoginAttempts, _getLoginAttempts } from '../services/authService';
import { User } from '../models';

// In-memory stand-in for the persisted LoginAttempt model. Named with a `mock`
// prefix so it can be referenced inside the hoisted jest.mock factory.
type MockAttemptRow = { email: string; failedAttempts: number; lockedUntil: Date | null; save: () => Promise<void> };
const mockAttemptStore = new Map<string, MockAttemptRow>();

function mockMakeRow(email: string, failedAttempts: number, lockedUntil: Date | null): MockAttemptRow {
  const row: MockAttemptRow = {
    email,
    failedAttempts,
    lockedUntil,
    save: async () => {
      mockAttemptStore.set(row.email, row);
    },
  };
  return row;
}

// Mock the models used by authService
jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  },
  PasswordResetToken: {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  LoginAttempt: {
    findOne: jest.fn(async ({ where }: { where: { email: string } }) => mockAttemptStore.get(where.email) ?? null),
    create: jest.fn(async ({ email, failedAttempts, lockedUntil }: { email: string; failedAttempts: number; lockedUntil: Date | null }) => {
      const row = mockMakeRow(email, failedAttempts, lockedUntil);
      mockAttemptStore.set(email, row);
      return row;
    }),
    destroy: jest.fn(async (opts: { where?: { email?: string }; truncate?: boolean } = {}) => {
      if (opts.truncate || !opts.where?.email) {
        mockAttemptStore.clear();
      } else {
        mockAttemptStore.delete(opts.where.email);
      }
    }),
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

// Registration requires a verified Gmail. The OTP mechanics live in
// verificationService (and are tested there); stub the two collaborators
// authService calls into so these tests stay focused on registration.
jest.mock('../services/verificationService', () => {
  const actual = jest.requireActual('../services/verificationService');
  return {
    ...actual,
    assertGmailAvailable: jest.fn(async () => undefined),
    consumeGmailOtp: jest.fn(async () => undefined),
  };
});

const mockedUser = User as jest.Mocked<typeof User>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('authService', () => {
  const now = new Date();

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    await _resetLoginAttempts();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // ─── Registration ───────────────────────────────────────────────────

  describe('register', () => {
    const validInput = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password1',
      gmail: 'johndoe@gmail.com',
      gmailOtp: '123456',
    };

    const createdUser = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      password: 'hashedpassword',
      role: 'customer' as const,
      isActive: true,
      gmail: 'johndoe@gmail.com',
      gmailVerifiedAt: now,
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
        expect(result.user.name).toBe('Jo');
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

      it('rejects a duplicate that differs only by letter casing (409)', async () => {
        // john@example.com and JOHN@Example.com are the same mailbox, so the
        // second signup must be refused rather than creating a second account.
        (mockedUser.findOne as jest.Mock).mockResolvedValue(createdUser);

        await expect(
          register({ ...validInput, email: 'JOHN@Example.com' })
        ).rejects.toMatchObject({
          statusCode: 409,
          errors: expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ]),
        });

        expect(mockedUser.create).not.toHaveBeenCalled();
      });

      it('checks uniqueness against archived accounts too', async () => {
        (mockedUser.findOne as jest.Mock).mockResolvedValue(createdUser);

        await expect(register(validInput)).rejects.toMatchObject({ statusCode: 409 });

        expect((mockedUser.findOne as jest.Mock).mock.calls[0][0]).toMatchObject({
          where: { email: 'john@example.com' },
          paranoid: false,
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

        // register now auto-logs-in, returning { token, user }
        expect(result).toHaveProperty('token');
        expect(result.user).toHaveProperty('id');
        expect(result.user).toHaveProperty('name');
        expect(result.user).toHaveProperty('email');
        expect(result.user).toHaveProperty('role');
        expect(result.user).not.toHaveProperty('password');
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

      it('trims and lowercases the Gmail address before storing', async () => {
        (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
        (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
        (mockedUser.create as jest.Mock).mockResolvedValue(createdUser);

        await register({ ...validInput, gmail: '  JohnDoe@Gmail.COM  ' });

        expect(mockedUser.create).toHaveBeenCalledWith(
          expect.objectContaining({
            gmail: 'johndoe@gmail.com',
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

    it('allows a deactivated (non-archived) account to log in', async () => {
      // Per the revisions, deactivation no longer blocks login — a deactivated
      // technician simply cannot be assigned work. Only archived accounts are
      // barred, and those are excluded by the paranoid findOne (returns null).
      const inactiveUser = { ...mockUser, isActive: false };
      (mockedUser.findOne as jest.Mock).mockResolvedValue(inactiveUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedJwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const result = await login(validLoginInput);
      expect(result.token).toBe('mock-jwt-token');
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
      const entry = await _getLoginAttempts('john@example.com');
      expect(entry?.failedAttempts).toBe(3);

      // Successful login
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedJwt.sign as jest.Mock).mockReturnValue('token');
      await login({ email: 'john@example.com', password: 'Password1' });

      // Failed attempts should be reset
      const entryAfter = await _getLoginAttempts('john@example.com');
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

      // Simulate time passing by pushing lockedUntil into the past in the store
      const row = await (await import('../models')).LoginAttempt.findOne({ where: { email: 'john@example.com' } });
      if (row && row.lockedUntil) {
        row.lockedUntil = new Date(Date.now() - 1); // Set lockout to the past
        await row.save();
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
