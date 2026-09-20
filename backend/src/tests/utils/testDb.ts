/**
 * In-Memory SQLite Sequelize Test Harness
 *
 * Provides a real (not mocked) Sequelize instance backed by an in-memory
 * SQLite database for DB-backed property tests and integration tests.
 *
 * Property tests that touch the database (design properties 10, 13, 14, 17,
 * 18, 19, 21, 22) need a real ORM with genuine transaction semantics — the
 * jest mock models in `mockModels.ts` cannot exercise rollback or ENUM
 * constraints. This harness gives each case a fresh, isolated schema.
 *
 * Usage (per-case fresh sync — the pattern required by the design):
 *
 *   import { createTestSequelize, TestModels } from '../tests/utils/testDb';
 *
 *   let db: Sequelize;
 *   let models: TestModels;
 *
 *   beforeEach(async () => {
 *     ({ sequelize: db, models } = await createTestSequelize());
 *   });
 *   afterEach(async () => {
 *     await db.close();
 *   });
 *
 * For fast-check DB-backed properties, call `createTestSequelize()` (or
 * `resetTestSequelize(db)`) inside the async predicate so every generated
 * case runs against a clean schema:
 *
 *   await fc.assert(
 *     fc.asyncProperty(gen, async (input) => {
 *       const { sequelize, models } = await createTestSequelize();
 *       try {
 *         // ...exercise the property against `models`...
 *       } finally {
 *         await sequelize.close();
 *       }
 *     }),
 *     { numRuns: 100 },
 *   );
 */

import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';

// Import the models through the `models/index.ts` barrel rather than each model
// file directly. The models have a circular association
// (`AirconProduct` <-> `ProductImage`); routing every consumer through the
// single barrel gives one deterministic module-evaluation order (the same one
// production uses via `database/connection.ts`), which avoids a
// "Cannot access 'AirconProduct' before initialization" crash that occurs when
// the model files are re-imported in a different order.
import {
  models as modelClasses,
  User,
  ServiceRequest,
  RoomAssessment,
  AiRecommendation,
  AirconProduct,
  ProductImage,
  Brand,
  TechnicianDetail,
  TechnicianSchedule,
  BtuFactor,
  Report,
  ServiceType,
  PasswordResetToken,
  LoginAttempt,
  RecommendedProduct,
  EmailVerification,
} from '../../models';

/** The model classes made available on a test harness instance. */
export interface TestModels {
  User: typeof User;
  ServiceRequest: typeof ServiceRequest;
  RoomAssessment: typeof RoomAssessment;
  AiRecommendation: typeof AiRecommendation;
  AirconProduct: typeof AirconProduct;
  ProductImage: typeof ProductImage;
  Brand: typeof Brand;
  TechnicianDetail: typeof TechnicianDetail;
  TechnicianSchedule: typeof TechnicianSchedule;
  BtuFactor: typeof BtuFactor;
  Report: typeof Report;
  ServiceType: typeof ServiceType;
  PasswordResetToken: typeof PasswordResetToken;
  LoginAttempt: typeof LoginAttempt;
  RecommendedProduct: typeof RecommendedProduct;
  EmailVerification: typeof EmailVerification;
}

export interface TestHarness {
  sequelize: Sequelize;
  models: TestModels;
}

function collectModels(): TestModels {
  return {
    User,
    ServiceRequest,
    RoomAssessment,
    AiRecommendation,
    AirconProduct,
    ProductImage,
    Brand,
    TechnicianDetail,
    TechnicianSchedule,
    BtuFactor,
    Report,
    ServiceType,
    PasswordResetToken,
    LoginAttempt,
    RecommendedProduct,
    EmailVerification,
  };
}

/**
 * Creates a fresh in-memory SQLite Sequelize instance with all models
 * registered and the schema synced (`force: true`, so a clean schema each
 * time). Always close the returned instance (e.g. in `afterEach` or a
 * `finally` block) to avoid leaking open handles across cases.
 */
export async function createTestSequelize(): Promise<TestHarness> {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    models: modelClasses,
  });

  // Fresh schema per case — DB-backed properties must not see state from a
  // prior iteration.
  await sequelize.sync({ force: true });

  return { sequelize, models: collectModels() };
}

/**
 * Rebuilds the schema on an existing instance (drops and recreates every
 * table). Useful when reusing a single connection across many cases while
 * still guaranteeing a clean slate per case.
 */
export async function resetTestSequelize(sequelize: Sequelize): Promise<void> {
  await sequelize.sync({ force: true });
}
