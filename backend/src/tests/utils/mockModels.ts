/**
 * Mock Sequelize Model Factory
 *
 * Creates mock instances and static methods for Sequelize models,
 * allowing unit tests to run without a real database connection.
 */

type MockModelInstance = Record<string, any> & {
  save: jest.Mock;
  destroy: jest.Mock;
  update: jest.Mock;
  reload: jest.Mock;
  toJSON: jest.Mock;
  get: jest.Mock;
};

type MockModelStatic = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  findByPk: jest.Mock;
  findAndCountAll: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  destroy: jest.Mock;
  count: jest.Mock;
  bulkCreate: jest.Mock;
  scope: jest.Mock;
};

/**
 * Creates a mock Sequelize model instance with common instance methods.
 *
 * @param data - Object with property values for the mock instance
 * @returns A mock model instance with save, destroy, update, reload, toJSON, and get methods
 */
export function createMockInstance(data: Record<string, any> = {}): MockModelInstance {
  const instance: MockModelInstance = {
    ...data,
    save: jest.fn().mockResolvedValue(data),
    destroy: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockImplementation((updates: Record<string, any>) => {
      Object.assign(instance, updates);
      return Promise.resolve(instance);
    }),
    reload: jest.fn().mockResolvedValue(data),
    toJSON: jest.fn().mockReturnValue({ ...data }),
    get: jest.fn().mockImplementation((key?: string) => {
      if (key) return data[key];
      return { ...data };
    }),
  };

  return instance;
}

/**
 * Creates a mock Sequelize model class with all common static methods.
 * Each method is a jest.fn() that can be configured in individual tests.
 *
 * @returns An object with mocked static methods (findAll, findOne, findByPk, create, update, destroy, etc.)
 */
export function createMockModel(): MockModelStatic {
  const mockModel: MockModelStatic = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findByPk: jest.fn().mockResolvedValue(null),
    findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
    create: jest.fn().mockResolvedValue(createMockInstance()),
    update: jest.fn().mockResolvedValue([1]),
    destroy: jest.fn().mockResolvedValue(1),
    count: jest.fn().mockResolvedValue(0),
    bulkCreate: jest.fn().mockResolvedValue([]),
    scope: jest.fn().mockReturnThis(),
  };

  return mockModel;
}

/**
 * Creates a mock model class that returns preconfigured instances.
 * Useful when you need findOne/findByPk to return specific data.
 *
 * @param defaultData - Default data that the model's find methods will return
 * @returns A mock model with find methods preconfigured to return instances with the given data
 */
export function createMockModelWithData(defaultData: Record<string, any>): MockModelStatic {
  const instance = createMockInstance(defaultData);
  const mockModel = createMockModel();

  mockModel.findOne.mockResolvedValue(instance);
  mockModel.findByPk.mockResolvedValue(instance);
  mockModel.create.mockResolvedValue(instance);
  mockModel.findAll.mockResolvedValue([instance]);
  mockModel.findAndCountAll.mockResolvedValue({ rows: [instance], count: 1 });

  return mockModel;
}
