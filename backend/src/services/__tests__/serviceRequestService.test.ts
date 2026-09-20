import {
  createServiceRequest,
  approveServiceRequest,
  rejectServiceRequest,
} from '../serviceRequestService';

// Mock the models used by serviceRequestService
jest.mock('../../models', () => ({
  ServiceRequest: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
  },
  ServiceType: {
    findAll: jest.fn(),
  },
  TechnicianSchedule: {},
  TechnicianDetail: {},
}));

import { ServiceRequest, User, ServiceType } from '../../models';

const mockedServiceRequest = ServiceRequest as jest.Mocked<typeof ServiceRequest>;
const mockedUser = User as jest.Mocked<typeof User>;
const mockedServiceType = ServiceType as jest.Mocked<typeof ServiceType>;

describe('serviceRequestService', () => {
  // A fully valid create payload under the current contract: named service,
  // required service address, and contact number.
  const validInput = {
    serviceType: 'Installation',
    acDetails: 'Need a new AC unit installed in the living room',
    serviceStreet: '12 Rizal St.',
    serviceBarangay: 'Poblacion',
    serviceCity: 'Makati',
    serviceProvince: 'Metro Manila',
    contactNumber: '09171234567',
  };
  const userId = 1;

  // The customer profile lookup (for address/contact fallback) and the active
  // service list are needed by createServiceRequest.
  beforeEach(() => {
    (mockedUser.findByPk as jest.Mock).mockResolvedValue({
      id: userId,
      street: null,
      barangay: null,
      city: null,
      province: null,
      contactNumber: null,
    });
    (mockedServiceType.findAll as jest.Mock).mockResolvedValue([
      { name: 'Installation' },
      { name: 'Repair' },
      { name: 'Maintenance' },
    ]);
  });

  // ─── Creation with pending status ─────────────────────────────────────────

  describe('createServiceRequest', () => {
    it('successfully creates request with valid input (status set to pending)', async () => {
      const now = new Date();
      const mockCreated = {
        id: 1,
        userId,
        serviceType: 'Installation',
        acDetails: validInput.acDetails,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      (mockedServiceRequest.create as jest.Mock).mockResolvedValue(mockCreated);

      const result = await createServiceRequest(validInput, userId);

      expect(result).toEqual(mockCreated);
      expect(mockedServiceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          serviceType: 'Installation',
          acDetails: validInput.acDetails,
          status: 'pending',
          serviceStreet: '12 Rizal St.',
          serviceBarangay: 'Poblacion',
          serviceCity: 'Makati',
          serviceProvince: 'Metro Manila',
          contactNumber: '09171234567',
        })
      );
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

    it('rejects a serviceType that does not match any active service', async () => {
      try {
        await createServiceRequest({ ...validInput, serviceType: 'Teleportation' }, userId);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'serviceType', message: expect.stringContaining('not available') }),
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

    it('stores the canonical service name regardless of input casing', async () => {
      const now = new Date();
      (mockedServiceRequest.create as jest.Mock).mockResolvedValue({
        id: 1,
        userId,
        serviceType: 'Maintenance',
        acDetails: validInput.acDetails,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      // Input in a different case still matches and stores the canonical name.
      await createServiceRequest({ ...validInput, serviceType: 'maintenance' }, userId);

      expect(mockedServiceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ serviceType: 'Maintenance' })
      );
    });

    it('falls back to the profile address when service address parts are blank', async () => {
      (mockedUser.findByPk as jest.Mock).mockResolvedValue({
        id: userId,
        street: '5 Profile Rd.',
        barangay: 'Profile Brgy',
        city: 'Profile City',
        province: 'Profile Province',
        contactNumber: '09990001111',
      });
      (mockedServiceRequest.create as jest.Mock).mockResolvedValue({ id: 1 });

      await createServiceRequest(
        {
          serviceType: 'Installation',
          acDetails: validInput.acDetails,
          serviceStreet: '',
          serviceBarangay: '',
          serviceCity: '',
          serviceProvince: '',
          contactNumber: '',
        },
        userId
      );

      expect(mockedServiceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceStreet: '5 Profile Rd.',
          serviceBarangay: 'Profile Brgy',
          serviceCity: 'Profile City',
          serviceProvince: 'Profile Province',
          contactNumber: '09990001111',
        })
      );
    });

    it('rejects when service address is blank and profile has none', async () => {
      try {
        await createServiceRequest(
          {
            serviceType: 'Installation',
            acDetails: validInput.acDetails,
            serviceStreet: '',
            serviceBarangay: '',
            serviceCity: '',
            serviceProvince: '',
            contactNumber: '09171234567',
          },
          userId
        );
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'serviceStreet' }),
          ])
        );
      }
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
