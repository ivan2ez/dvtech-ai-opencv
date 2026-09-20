import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { register, login, _resetLoginAttempts, _getLoginAttempts } from '../authService';

// In-memory stand-in for the persisted LoginAttempt model, so lockout logic can
// be exercised without a real database. Named with a `mock` prefix so it can be
// referenced inside the hoisted jest.mock factory.
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
jest.mock('../../models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
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

// Registration now requires a verified Gmail address. The OTP challenge itself
// is covered by verificationService's own tests, so here we stub the two
// collaborators authService calls into and assert that registration refuses to
// proceed when they reject.
jest.mock('../verificationService', () => {
  const actual = jest.requireActual('../verificationService');
  return {
    ...actual,
    assertGmailAvailable: jest.fn(async () => undefined),
    consumeGmailOtp: jest.fn(async () => undefined),
  };
});

// Import the mocked User
import { User } from '../../models';
import { assertGmailAvailable, consumeGmailOtp } from '../verificationService';

const mockedUser = User as jest.Mocked<typeof User>;
const mockedAssertGmailAvailable = assertGmailAvailable as jest.MockedFunction<
  typeof assertGmailAvailable
>;
const mockedConsumeGmailOtp = consumeGmailOtp as jest.MockedFunction<typeof consumeGmailOtp>;

describe('authService', () => {
  const validInput = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'Password1',
    gmail: 'johndoe@gmail.com',
    gmailOtp: '123456',
  };

  beforeEach(async () => {
    await _resetLoginAttempts();
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    mockedAssertGmailAvailable.mockReset().mockResolvedValue(undefined);
    mockedConsumeGmailOtp.mockReset().mockResolvedValue(undefined);
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

    it('rejects a non-Gmail verification address', async () => {
      try {
        await register({ ...validInput, gmail: 'john@yahoo.com' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'gmail', message: expect.stringContaining('Gmail') }),
          ])
        );
      }
    });

    it('successfully registers with valid input and returns a token + user (auto-login)', async () => {
      const now = new Date();
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
      (mockedUser.create as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'customer',
        isActive: true,
        street: null,
        barangay: null,
        city: null,
        province: null,
        contactNumber: null,
        gmail: 'johndoe@gmail.com',
        gmailVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const result = await register(validInput);

      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.user).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'customer',
        isActive: true,
        street: null,
        barangay: null,
        city: null,
        province: null,
        contactNumber: null,
        gmail: 'johndoe@gmail.com',
        gmailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    it('stores the email and gmail lowercased so casing never forks an account', async () => {
      const now = new Date();
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
      (mockedUser.create as jest.Mock).mockImplementation(async (data: any) => ({
        id: 1,
        ...data,
        createdAt: now,
        updatedAt: now,
      }));

      await register({
        ...validInput,
        email: '  JoHn@Example.COM ',
        gmail: 'JohnDoe@Gmail.com',
      });

      const createCall = (mockedUser.create as jest.Mock).mock.calls[0][0];
      expect(createCall.email).toBe('john@example.com');
      expect(createCall.gmail).toBe('johndoe@gmail.com');
    });

    it('records the Gmail as verified only after the OTP is consumed', async () => {
      const now = new Date();
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
      (mockedUser.create as jest.Mock).mockImplementation(async (data: any) => ({
        id: 1,
        ...data,
        createdAt: now,
        updatedAt: now,
      }));

      await register(validInput);

      expect(mockedConsumeGmailOtp).toHaveBeenCalledWith({
        gmail: 'johndoe@gmail.com',
        purpose: 'registration',
        code: '123456',
      });
      const createCall = (mockedUser.create as jest.Mock).mock.calls[0][0];
      expect(createCall.gmailVerifiedAt).toBeInstanceOf(Date);
    });

    it('does not create the account when the OTP is rejected', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue(null);
      const otpError = Object.assign(new Error('Incorrect verification code'), {
        statusCode: 400,
        errors: [{ field: 'gmailOtp', message: 'Incorrect code.' }],
      });
      mockedConsumeGmailOtp.mockRejectedValue(otpError);

      try {
        await register(validInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field: 'gmailOtp' })])
        );
      }

      expect(mockedUser.create).not.toHaveBeenCalled();
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

    it('treats a differently-cased email as a duplicate', async () => {
      (mockedUser.findOne as jest.Mock).mockResolvedValue({ id: 1, email: 'john@example.com' });

      try {
        await register({ ...validInput, email: 'JoHn@Example.com' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'email', message: expect.stringContaining('already') }),
          ])
        );
      }

      // The lookup must use the canonical lowercased form.
      expect((mockedUser.findOne as jest.Mock).mock.calls[0][0].where.email).toBe(
        'john@example.com'
      );
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
        gmailVerified: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    it('authenticates when the email casing differs from registration', async () => {
      const hashedPassword = await bcrypt.hash('Password1', 10);
      const now = new Date();
      (mockedUser.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        role: 'customer' as const,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const result = await login({ email: '  JoHn@Example.COM ', password: 'Password1' });

      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('john@example.com');
      // Same mailbox, so the lookup is made with the canonical lowercased form.
      expect((mockedUser.findOne as jest.Mock).mock.calls[0][0].where.email).toBe(
        'john@example.com'
      );
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

    it('allows a deactivated (non-archived) account to log in', async () => {
      // Per the revisions, deactivation no longer blocks login. Archived
      // accounts are excluded by the paranoid findOne instead.
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

      const result = await login(loginInput);
      expect(result.token).toBeDefined();
      expect(result.user.id).toBe(1);
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

      // Simulate time passing by pushing lockedUntil into the past in the store
      const entry = await _getLoginAttempts('john@example.com');
      expect(entry).toBeDefined();
      const row = await (await import('../../models')).LoginAttempt.findOne({ where: { email: 'john@example.com' } });
      row!.lockedUntil = new Date(Date.now() - 1000); // 1 second in the past
      await row!.save();

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
      const entryBefore = await _getLoginAttempts('john@example.com');
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
      const entryAfter = await _getLoginAttempts('john@example.com');
      expect(entryAfter).toBeUndefined();
    });
  });
});
