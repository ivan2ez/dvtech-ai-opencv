import {
  createServiceRequest,
  approveServiceRequest,
  rejectServiceRequest,
} from '../serviceRequestService';

// Mock the ServiceRequest model
jest.mock('../../models', () => ({
  ServiceRequest: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
  },
}));

import { ServiceRequest } from '../../models';

const mockedServiceRequest = ServiceRequest as jest.Mocked<typeof ServiceRequest>;

describe('serviceRequestService', () => {
  const validInput = {
    serviceType: 'installation',
    acDetails: 'Need a new AC unit installed in the living room',
  };
  const userId = 1;

  // ─── Creation with pending status ─────────────────────────────────────────

  describe('createServiceRequest', () => {
    it('successfully creates request with valid input (status set to pending)', async () => {
      const now = new Date();
      const mockCreated = {
        id: 1,
        userId,
        serviceType: 'installation',
        acDetails: validInput.acDetails,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      (mockedServiceRequest.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await createServiceRequest(validInput, userId);

      expect(result).toEqual(mockCreated);
      expect(mockedServiceRequest.create).toHaveBeenCalledWith({
        userId,
        serviceType: 'installation',
        acDetails: validInput.acDetails,
        status: 'pending',
      });
    });

    it('rejects missing serviceType', async () => {
      try {
        await createServiceRequest({ ...validInput, serviceType: '' }, userId);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'serviceType' }),
          ])
        );
      }
    });

    it('rejects invalid serviceType (not installation/maintenance/repair)', async () => {
      try {
        await createServiceRequest({ ...validInput, serviceType: 'cleaning' }, userId);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'serviceType', message: expect.stringContaining('must be one of') }),
          ])
        );
      }
    });

    it('rejects missing acDetails', async () => {
      try {
        await createServiceRequest({ ...validInput, acDetails: '' }, userId);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'acDetails' }),
          ])
        );
      }
    });

    it('rejects acDetails longer than 1000 characters', async () => {
      const longDetails = 'A'.repeat(1001);
      try {
        await createServiceRequest({ ...validInput, acDetails: longDetails }, userId);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'acDetails', message: expect.stringContaining('1000') }),
          ])
        );
      }
    });

    it('normalizes serviceType to lowercase', async () => {
      const now = new Date();
      (mockedServiceRequest.create as jest.Mock).mockResolvedValue({
        id: 1,
        userId,
        serviceType: 'maintenance',
        acDetails: validInput.acDetails,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      await createServiceRequest({ ...validInput, serviceType: 'Maintenance' }, userId);

      expect(mockedServiceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ serviceType: 'maintenance' })
      );
    });
  });

  // ─── Approval Workflow ────────────────────────────────────────────────────

  describe('approveServiceRequest', () => {
    it('successfully updates pending request to approved', async () => {
      const saveMock = jest.fn();
      const mockRequest = {
        id: 1,
        userId: 2,
        serviceType: 'installation',
        status: 'pending',
        save: saveMock,
      };
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(mockRequest);

      const result = await approveServiceRequest(1, 'admin');

      expect(result.status).toBe('approved');
      expect(saveMock).toHaveBeenCalled();
    });

    it('rejects if request is not pending (400)', async () => {
      const mockRequest = {
        id: 1,
        status: 'approved',
        save: jest.fn(),
      };
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(mockRequest);

      try {
        await approveServiceRequest(1, 'admin');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('pending');
      }
    });

    it('rejects if request not found (404)', async () => {
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(null);

      try {
        await approveServiceRequest(999, 'admin');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });
  });

  describe('rejectServiceRequest', () => {
    const validReason = 'This request cannot be fulfilled due to scheduling conflicts';

    it('successfully updates pending request to rejected with valid reason', async () => {
      const saveMock = jest.fn();
      const mockRequest = {
        id: 1,
        userId: 2,
        serviceType: 'repair',
        status: 'pending',
        save: saveMock,
      };
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(mockRequest);

      const result = await rejectServiceRequest(1, 'admin', validReason);

      expect(result.status).toBe('rejected');
      expect(saveMock).toHaveBeenCalled();
    });

    it('rejects if reason is missing', async () => {
      const mockRequest = { id: 1, status: 'pending', save: jest.fn() };
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(mockRequest);

      try {
        await rejectServiceRequest(1, 'admin', '');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'reason' }),
          ])
        );
      }
    });

    it('rejects if reason is shorter than 10 characters', async () => {
      const mockRequest = { id: 1, status: 'pending', save: jest.fn() };
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(mockRequest);

      try {
        await rejectServiceRequest(1, 'admin', 'Too short');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'reason', message: expect.stringContaining('10') }),
          ])
        );
      }
    });

    it('rejects if reason exceeds 500 characters', async () => {
      const mockRequest = { id: 1, status: 'pending', save: jest.fn() };
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(mockRequest);

      const longReason = 'A'.repeat(501);
      try {
        await rejectServiceRequest(1, 'admin', longReason);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'reason', message: expect.stringContaining('500') }),
          ])
        );
      }
    });

    it('rejects if request is not pending (400)', async () => {
      const mockRequest = { id: 1, status: 'completed', save: jest.fn() };
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(mockRequest);

      try {
        await rejectServiceRequest(1, 'admin', validReason);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('pending');
      }
    });

    it('rejects if request not found (404)', async () => {
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(null);

      try {
        await rejectServiceRequest(999, 'admin', validReason);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });
  });

  // ─── Role Validation ──────────────────────────────────────────────────────

  describe('role validation', () => {
    it('approve: only admin role can approve (403 for other roles)', async () => {
      try {
        await approveServiceRequest(1, 'customer');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain('Admin');
      }
    });

    it('approve: technician role cannot approve (403)', async () => {
      try {
        await approveServiceRequest(1, 'technician');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });

    it('reject: only admin role can reject (403 for other roles)', async () => {
      try {
        await rejectServiceRequest(1, 'customer', 'Some valid reason for rejection');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain('Admin');
      }
    });

    it('reject: technician role cannot reject (403)', async () => {
      try {
        await rejectServiceRequest(1, 'technician', 'Some valid reason for rejection');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });
  });
});
