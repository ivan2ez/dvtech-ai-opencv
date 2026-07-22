import {
  assignTechnician,
  acceptTask,
  rejectTask,
  updateTaskStatus,
  completeTask,
} from '../scheduleService';

// Mock sequelize Op
jest.mock('sequelize', () => ({
  Op: { notIn: Symbol('notIn') },
}));

// Mock models
jest.mock('../../models', () => ({
  ServiceRequest: {
    findByPk: jest.fn(),
  },
  TechnicianDetail: {
    findOne: jest.fn(),
  },
  TechnicianSchedule: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  User: {},
}));

import { ServiceRequest, TechnicianDetail, TechnicianSchedule } from '../../models';

const mockedServiceRequest = ServiceRequest as jest.Mocked<typeof ServiceRequest>;
const mockedTechnicianDetail = TechnicianDetail as jest.Mocked<typeof TechnicianDetail>;
const mockedTechnicianSchedule = TechnicianSchedule as jest.Mocked<typeof TechnicianSchedule>;

// Helper to get a future date string in YYYY-MM-DD format
function getFutureDate(daysAhead = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

describe('scheduleService', () => {
  // ─── assignTechnician ─────────────────────────────────────────────────────

  describe('assignTechnician', () => {
    const futureDate = getFutureDate();

    const validInput = {
      technicianId: 1,
      serviceRequestId: 10,
      scheduledDate: futureDate,
    };

    function createMockServiceRequest() {
      return {
        id: 10,
        status: 'approved',
        save: jest.fn(),
      };
    }

    function createMockTechnician() {
      return {
        userId: 1,
        availabilityStatus: 'available',
      };
    }

    const mockCreatedSchedule = {
      id: 1,
      technicianId: 1,
      serviceRequestId: 10,
      scheduledDate: futureDate,
      status: 'assigned',
      priority: 'medium',
    };

    beforeEach(() => {
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(createMockServiceRequest());
      (mockedTechnicianDetail.findOne as jest.Mock).mockResolvedValue(createMockTechnician());
      (mockedTechnicianSchedule.findOne as jest.Mock).mockResolvedValue(null);
      (mockedTechnicianSchedule.create as jest.Mock).mockResolvedValue(mockCreatedSchedule);
    });

    it('successfully assigns technician with valid input', async () => {
      const result = await assignTechnician(validInput);

      expect(result).toEqual(mockCreatedSchedule);
      expect(mockedTechnicianSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          technicianId: 1,
          serviceRequestId: 10,
          scheduledDate: futureDate,
          status: 'assigned',
          priority: 'medium',
        })
      );
    });

    it('defaults priority to medium when not specified', async () => {
      const result = await assignTechnician(validInput);

      expect(mockedTechnicianSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'medium' })
      );
      expect(result).toEqual(mockCreatedSchedule);
    });

    it('rejects if service request not found (404)', async () => {
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(null);

      try {
        await assignTechnician(validInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toContain('Service request not found');
      }
    });

    it('rejects if service request status is not approved (400)', async () => {
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue({
        id: 10,
        status: 'pending',
        save: jest.fn(),
      });

      try {
        await assignTechnician(validInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('approved');
      }
    });

    it('rejects if technician not found (404)', async () => {
      (mockedTechnicianDetail.findOne as jest.Mock).mockResolvedValue(null);

      try {
        await assignTechnician(validInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toContain('Technician not found');
      }
    });

    it('rejects if technician is not available (400)', async () => {
      (mockedTechnicianDetail.findOne as jest.Mock).mockResolvedValue({
        userId: 1,
        availabilityStatus: 'busy',
      });

      try {
        await assignTechnician(validInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('not available');
      }
    });

    it('rejects if scheduled date is in the past', async () => {
      try {
        await assignTechnician({ ...validInput, scheduledDate: '2020-01-01' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'scheduledDate', message: expect.stringContaining('future') }),
          ])
        );
      }
    });

    it('rejects if scheduled date format is invalid', async () => {
      try {
        await assignTechnician({ ...validInput, scheduledDate: '25-12-2025' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'scheduledDate', message: expect.stringContaining('YYYY-MM-DD') }),
          ])
        );
      }
    });

    it('validates required field technicianId', async () => {
      try {
        await assignTechnician({ ...validInput, technicianId: 0 });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'technicianId' }),
          ])
        );
      }
    });

    it('validates required field serviceRequestId', async () => {
      try {
        await assignTechnician({ ...validInput, serviceRequestId: 0 });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'serviceRequestId' }),
          ])
        );
      }
    });

    it('validates required field scheduledDate', async () => {
      try {
        await assignTechnician({ ...validInput, scheduledDate: '' });
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'scheduledDate' }),
          ])
        );
      }
    });
  });

  // ─── Conflict Detection ────────────────────────────────────────────────────

  describe('assignTechnician - conflict detection', () => {
    const futureDate = getFutureDate();

    const validInput = {
      technicianId: 1,
      serviceRequestId: 10,
      scheduledDate: futureDate,
    };

    const mockServiceRequest = {
      id: 10,
      status: 'approved',
      save: jest.fn(),
    };

    const mockTechnician = {
      userId: 1,
      availabilityStatus: 'available',
    };

    beforeEach(() => {
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(mockServiceRequest);
      (mockedTechnicianDetail.findOne as jest.Mock).mockResolvedValue(mockTechnician);
    });

    it('rejects if technician has existing active task on same date (409)', async () => {
      (mockedTechnicianSchedule.findOne as jest.Mock).mockResolvedValue({
        id: 99,
        technicianId: 1,
        scheduledDate: futureDate,
        status: 'assigned',
      });

      try {
        await assignTechnician(validInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.message).toContain('already has an active task');
      }
    });

    it('allows assignment if existing tasks on same date are completed/rejected', async () => {
      // findOne returns null when filtering out completed/rejected — meaning no active conflicts
      (mockedTechnicianSchedule.findOne as jest.Mock).mockResolvedValue(null);
      (mockedTechnicianSchedule.create as jest.Mock).mockResolvedValue({
        id: 2,
        technicianId: 1,
        serviceRequestId: 10,
        scheduledDate: futureDate,
        status: 'assigned',
        priority: 'medium',
      });

      const result = await assignTechnician(validInput);
      expect(result.status).toBe('assigned');
      expect(mockedTechnicianSchedule.create).toHaveBeenCalled();
    });
  });

  // ─── Status Transitions ────────────────────────────────────────────────────

  describe('acceptTask', () => {
    it('transitions from assigned to accepted', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'assigned',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      const result = await acceptTask(1, 5);

      expect(result.status).toBe('accepted');
      expect(mockSchedule.save).toHaveBeenCalled();
    });

    it('rejects if status is not assigned (400)', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'in-progress',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      try {
        await acceptTask(1, 5);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('assigned');
      }
    });

    it('rejects if schedule not found (404)', async () => {
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(null);

      try {
        await acceptTask(999, 5);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });

    it('rejects if technician is not the owner (403)', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'assigned',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      try {
        await acceptTask(1, 99); // different technician
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });
  });

  describe('updateTaskStatus', () => {
    it('transitions from accepted to in-progress', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'accepted',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      const result = await updateTaskStatus(1, 5);

      expect(result.status).toBe('in-progress');
      expect(mockSchedule.save).toHaveBeenCalled();
    });

    it('rejects if status is not accepted (400)', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'assigned',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      try {
        await updateTaskStatus(1, 5);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('accepted');
      }
    });

    it('rejects if schedule not found (404)', async () => {
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(null);

      try {
        await updateTaskStatus(999, 5);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });

    it('rejects if technician is not the owner (403)', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'accepted',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      try {
        await updateTaskStatus(1, 99);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });
  });

  describe('completeTask', () => {
    const validReport = 'This is a detailed completion report for the task.';

    it('transitions from in-progress to completed with report', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'in-progress',
        report: null as string | null,
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      const result = await completeTask(1, 5, validReport);

      expect(result.status).toBe('completed');
      expect(result.report).toBe(validReport);
      expect(mockSchedule.save).toHaveBeenCalled();
    });

    it('rejects if report less than 20 characters (400)', async () => {
      try {
        await completeTask(1, 5, 'short');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('20 characters');
      }
    });

    it('rejects if status is not in-progress (400)', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'accepted',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      try {
        await completeTask(1, 5, validReport);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('in-progress');
      }
    });

    it('rejects if schedule not found (404)', async () => {
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(null);

      try {
        await completeTask(999, 5, validReport);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });

    it('rejects if technician is not the owner (403)', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'in-progress',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      try {
        await completeTask(1, 99, validReport);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });
  });

  // ─── Rejection Flow ────────────────────────────────────────────────────────

  describe('rejectTask', () => {
    const validReason = 'I am unavailable on this date due to prior commitments';

    it('transitions from assigned to rejected, sets service request back to approved', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        serviceRequestId: 10,
        status: 'assigned',
        report: null as string | null,
        save: jest.fn(),
      };
      const mockSR = {
        id: 10,
        status: 'assigned',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);
      (mockedServiceRequest.findByPk as jest.Mock).mockResolvedValue(mockSR);

      const result = await rejectTask(1, 5, validReason);

      expect(result.status).toBe('rejected');
      expect(result.report).toBe(validReason);
      expect(mockSchedule.save).toHaveBeenCalled();
      expect(mockSR.status).toBe('approved');
      expect(mockSR.save).toHaveBeenCalled();
    });

    it('rejects if reason less than 10 characters (400)', async () => {
      try {
        await rejectTask(1, 5, 'short');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('10 characters');
      }
    });

    it('rejects if status is not assigned (400)', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'accepted',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      try {
        await rejectTask(1, 5, validReason);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('assigned');
      }
    });

    it('rejects if schedule not found (404)', async () => {
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(null);

      try {
        await rejectTask(999, 5, validReason);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
      }
    });

    it('rejects if technician is not the owner (403)', async () => {
      const mockSchedule = {
        id: 1,
        technicianId: 5,
        status: 'assigned',
        save: jest.fn(),
      };
      (mockedTechnicianSchedule.findByPk as jest.Mock).mockResolvedValue(mockSchedule);

      try {
        await rejectTask(1, 99, validReason);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
      }
    });
  });
});
