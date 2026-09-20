import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // `**/*.test.ts` already matches `*.property.test.ts`, but the property-test
  // pattern is listed explicitly so the PBT convention is discoverable here.
  testMatch: ['**/*.test.ts', '**/*.spec.ts', '**/*.property.test.ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            // Emitting `design:type` decorator metadata makes SWC reference the
            // decorated field's type eagerly at class-definition time. The
            // Sequelize models have a circular association
            // (`AirconProduct` <-> `ProductImage`), so eager metadata crashes
            // with "Cannot access 'AirconProduct' before initialization" when
            // the models are loaded for DB-backed property tests. sequelize-
            // typescript does not need the metadata here because every model
            // declares its column types explicitly and associations use lazy
            // `() => Model` arrows, so we disable it. (Production via tsx/esbuild
            // is unaffected — this only tunes the Jest transpiler.)
            decoratorMetadata: false,
          },
          target: 'es2020',
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['reflect-metadata'],
  // Clear mocks between each test
  clearMocks: true,
  restoreMocks: true,
};

export default config;
