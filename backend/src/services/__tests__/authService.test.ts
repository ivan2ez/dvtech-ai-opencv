import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { register, login, _resetLoginAttempts, _getLoginAttempts } from '../authService';

// Mock the User model
jest.mock('../../models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
}));

// Import the mocked User
import { User } from '../../models';

const mockedUser = User as jest.Mocked<typeof User>;

describe('authService', () => {
  const validInput = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'Password1',
  };

  beforeEach(() => {
    _resetLoginAttempts();
    process.env.JWT_SECRET = 'test-jwt-secret-key';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // ─── Registration Validation ──────────────────────────────────────────────

  describe('register - validation', () => {
    it('rejects missing name', async () => {
      try {
        await register({ ...validInput, name: '' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'name' }),
          ])
        );
      }
    });

    it('rejects name shorter than 2 characters', async () => {
      try {
        await register({ ...validInput, name: 'A' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'name', message: expect.stringContaining('at least 2') }),
          ])
        );
      }
    });

    it('rejects name longer than 100 characters', async () => {
      const longName = 'A'.repeat(101);
      try {
        await register({ ...validInput, name: longName });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'name', message: expect.stringContaining('100') }),
          ])
        );
      }
    });

    it('rejects missing email', async () => {
      try {
        await register({ ...validInput, email: '' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email' }),
          ])
        );
      }
    });

    it('rejects invalid email format', async () => {
      try {
        await register({ ...validInput, email: 'not-an-email' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email', message: expect.stringContaining('valid email') }),
          ])
        );
      }
    });

    it('rejects password shorter than 8 characters', async () => {
      try {
        await register({ ...validInput, password: 'Pass1' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password', message: expect.stringContaining('8') }),
          ])
        );
      }
    });

    it('rejects password without uppercase letter', async () => {
      try {
        await register({ ...validInput, password: 'password1' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password', message: expect.stringContaining('uppercase') }),
          ])
        );
      }
    });

    it('rejects password without lowercase letter', async () => {
      try {
        await register({ ...validInput, password: 'PASSWORD1' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password', message: expect.stringContaining('lowercase') }),
          ])
        );
      }
    });

    it('rejects password without digit', async () => {
      try {
        await register({ ...validInput, password: 'Passwordd' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'password', message: expect.stringContaining('digit') }),
          ])
        );
      }
    });

    it('successfully registers with valid input', async () => {
      const now = new Date();
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
      (mockedUser.create as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'customer',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const result = await register(validInput);

      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'customer',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    it('rejects duplicate email with 409', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue({ id: 1, email: 'john@example.com' });

      try {
        await register(validInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email', message: expect.stringContaining('already') }),
          ])
        );
      }
    });
  });

  // ─── Password Hashing ────────────────────────────────────────────────────

  describe('register - password hashing', () => {
    it('hashes password with bcrypt before storage (not plaintext)', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
      (mockedUser.create as jest.Mock).mockImplementation(async (data: any) => ({
        id: 1,
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await register(validInput);

      const createCall = (mockedUser.create as jest.Mock).mock.calls[0][0];
      expect(createCall.password).not.toBe(validInput.password);
      // bcrypt hashes start with $2b$
      expect(createCall.password).toMatch(/^\$2[aby]\$/);
    });

    it('uses bcrypt cost factor of 10', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
      (mockedUser.create as jest.Mock).mockImplementation(async (data: any) => ({
        id: 1,
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await register(validInput);

      const createCall = (mockedUser.create as jest.Mock).mock.calls[0][0];
      // bcrypt hash format: $2b$<cost>$...  — cost factor 10 shows as "10"
      const rounds = createCall.password.split('$')[2];
      expect(rounds).toBe('10');
    });
  });

  // ─── Login Verification ──────────────────────────────────────────────────

  describe('login - verification', () => {
    const loginInput = { email: 'john@example.com', password: 'Password1' };

    it('returns token and user data on valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password1', 10);
      const now = new Date();
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        role: 'customer' as const,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      (mockedUser.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await login(loginInput);

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.user).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'customer',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    it('rejects invalid email with 401', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);

      try {
        await login(loginInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(401);
      }
    });

    it('rejects invalid password with 401', async () => {
      const hashedPassword = await bcrypt.hash('DifferentPassword1', 10);
      (mockedUser.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        role: 'customer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      try {
        await login(loginInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(401);
      }
    });

    it('rejects deactivated account with 403', async () => {
      const hashedPassword = await bcrypt.hash('Password1', 10);
      (mockedUser.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        role: 'customer',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      try {
        await login(loginInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain('deactivated');
      }
    });
  });

  // ─── JWT Generation ───────────────────────────────────────────────────────

  describe('login - JWT generation', () => {
    it('token contains userId and role', async () => {
      const hashedPassword = await bcrypt.hash('Password1', 10);
      (mockedUser.findOne as jest.Mock).mockResolvedValue({
        id: 42,
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await login({ email: 'john@example.com', password: 'Password1' });
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET!) as any;

      expect(decoded.userId).toBe(42);
      expect(decoded.role).toBe('admin');
    });

    it('token expires in 24h', async () => {
      const hashedPassword = await bcrypt.hash('Password1', 10);
      (mockedUser.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        role: 'customer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await login({ email: 'john@example.com', password: 'Password1' });
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET!) as any;

      // exp - iat should be 86400 seconds (24 hours)
      const duration = decoded.exp - decoded.iat;
      expect(duration).toBe(86400);
    });
  });

  // ─── Account Lockout ──────────────────────────────────────────────────────

  describe('login - account lockout', () => {
    const loginInput = { email: 'john@example.com', password: 'WrongPass1' };

    it('locks account after 5 failed attempts (returns 423)', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);

      // First 4 attempts should return 401
      for (let i = 0; i < 4; i++) {
        try {
          await login(loginInput);
        } catch (err: any) {
          expect(err.statusCode).toBe(401);
        }
      }

      // 5th attempt should still be 401 (lockout is applied after this attempt)
      try {
        await login(loginInput);
      } catch (err: any) {
        expect(err.statusCode).toBe(401);
      }

      // 6th attempt should be 423 (locked)
      try {
        await login(loginInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(423);
      }
    });

    it('lockout expires after 15 minutes', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        try {
          await login(loginInput);
        } catch {
          // expected
        }
      }

      // Verify locked
      try {
        await login(loginInput);
        fail('Should have thrown 423');
      } catch (err: any) {
        expect(err.statusCode).toBe(423);
      }

      // Simulate time passing (set lockedUntil to past)
      const entry = _getLoginAttempts('john@example.com');
      expect(entry).toBeDefined();
      entry!.lockedUntil = new Date(Date.now() - 1000); // 1 second in the past

      // Now the lockout should be expired; next attempt should go through normally (401 since user doesn't exist)
      try {
        await login(loginInput);
      } catch (err: any) {
        expect(err.statusCode).toBe(401); // Not 423 anymore
      }
    });

    it('successful login resets failed attempts', async () => {
      const hashedPassword = await bcrypt.hash('Password1', 10);

      // First, cause some failed attempts
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
      for (let i = 0; i < 3; i++) {
        try {
          await login({ email: 'john@example.com', password: 'WrongPass1' });
        } catch {
          // expected
        }
      }

      // Verify there are failed attempts recorded
      const entryBefore = _getLoginAttempts('john@example.com');
      expect(entryBefore?.failedAttempts).toBe(3);

      // Now login successfully
      (mockedUser.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        role: 'customer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await login({ email: 'john@example.com', password: 'Password1' });

      // Failed attempts should be cleared
      const entryAfter = _getLoginAttempts('john@example.com');
      expect(entryAfter).toBeUndefined();
    });
  });
});
