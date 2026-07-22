/**
 * Test Utilities Barrel Export
 *
 * Import all test utilities from a single location:
 * import { createMockResponse, createMockModel, createMockUser } from '../tests/utils';
 */

export {
  createMockInstance,
  createMockModel,
  createMockModelWithData,
} from './mockModels';

export {
  createMockResponse,
  createMockRequest,
  createMockNext,
  createMockExpressContext,
} from './mockExpress';

export {
  createMockUser,
  createMockAdmin,
  createMockTechnician,
  createMockCustomer,
  createMockJwtPayload,
  createAuthHeader,
} from './mockAuth';
