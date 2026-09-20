/**
 * Jest Configuration Sanity Test
 *
 * Verifies that the Jest + ts-jest setup is working correctly,
 * including TypeScript compilation, reflect-metadata, and test utilities.
 */

import {
  createMockModel,
  createMockInstance,
  createMockModelWithData,
  createMockResponse,
  createMockRequest,
  createMockNext,
  createMockExpressContext,
  createMockUser,
  createMockAdmin,
  createMockTechnician,
  createMockCustomer,
  createMockJwtPayload,
  createAuthHeader,
} from './utils';

describe('Jest Configuration', () => {
  it('should run TypeScript tests correctly', () => {
    const sum = (a: number, b: number): number => a + b;
    expect(sum(1, 2)).toBe(3);
  });

  it('should load reflect-metadata without errors', () => {
    expect(Reflect).toBeDefined();
    expect(Reflect.getMetadata).toBeDefined();
  });
});

describe('Mock Model Utilities', () => {
  it('should create a mock model with static methods', () => {
    const model = createMockModel();

    expect(model.findAll).toBeDefined();
    expect(model.findOne).toBeDefined();
    expect(model.findByPk).toBeDefined();
    expect(model.create).toBeDefined();
    expect(model.update).toBeDefined();
    expect(model.destroy).toBeDefined();
    expect(model.count).toBeDefined();
    expect(model.findAndCountAll).toBeDefined();
  });

  it('should create a mock instance with instance methods', () => {
    const instance = createMockInstance({ id: 1, name: 'Test' });

    expect(instance.id).toBe(1);
    expect(instance.name).toBe('Test');
    expect(instance.save).toBeDefined();
    expect(instance.destroy).toBeDefined();
    expect(instance.update).toBeDefined();
    expect(instance.toJSON).toBeDefined();
  });

  it('should create a mock model preconfigured with data', async () => {
    const model = createMockModelWithData({ id: 5, name: 'Product' });

    const found = await model.findOne();
    expect(found).toBeDefined();
    expect(found!.id).toBe(5);
    expect(found!.name).toBe('Product');
  });
});

describe('Mock Express Utilities', () => {
  it('should create a chainable mock response', () => {
    const res = createMockResponse();

    res.status(200).json({ message: 'ok' });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'ok' });
    expect(res.statusCode).toBe(200);
  });

  it('should create a mock request with options', () => {
    const req = createMockRequest({
      body: { email: 'test@test.com' },
      params: { id: '1' },
      user: { userId: 1, role: 'admin' },
    });

    expect(req.body.email).toBe('test@test.com');
    expect(req.params.id).toBe('1');
    expect(req.user?.role).toBe('admin');
  });

  it('should create a mock next function', () => {
    const next = createMockNext();
    next();
    expect(next).toHaveBeenCalled();
  });

  it('should create a complete express context', () => {
    const { req, res, next } = createMockExpressContext({
      body: { name: 'test' },
    });

    expect(req.body.name).toBe('test');
    expect(res.status).toBeDefined();
    expect(next).toBeDefined();
  });
});

describe('Mock Auth Utilities', () => {
  it('should create a mock user with default values', () => {
    const user = createMockUser();

    expect(user.id).toBe(1);
    expect(user.email).toBe('test@example.com');
    expect(user.role).toBe('customer');
    expect(user.isActive).toBe(true);
  });

  it('should create a mock user with overrides', () => {
    const user = createMockUser({ role: 'admin', email: 'admin@test.com' });

    expect(user.role).toBe('admin');
    expect(user.email).toBe('admin@test.com');
  });

  it('should create role-specific mock users', () => {
    expect(createMockAdmin().role).toBe('admin');
    expect(createMockTechnician().role).toBe('technician');
    expect(createMockCustomer().role).toBe('customer');
  });

  it('should create a mock JWT payload', () => {
    const payload = createMockJwtPayload({ userId: 42, role: 'admin' });

    expect(payload.userId).toBe(42);
    expect(payload.role).toBe('admin');
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it('should create an auth header', () => {
    const header = createAuthHeader('my-token');
    expect(header).toBe('Bearer my-token');
  });
});
