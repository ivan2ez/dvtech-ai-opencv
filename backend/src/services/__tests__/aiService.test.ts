import { createRoomAssessment, generateRecommendation, CreateRoomAssessmentInput } from '../aiService';

// Mock models
jest.mock('../../models', () => ({
  RoomAssessment: {
    create: jest.fn(),
    findByPk: jest.fn(),
  },
  ServiceRequest: {
    findOne: jest.fn(),
  },
  BtuFactor: {
    findAll: jest.fn(),
  },
  AirconProduct: {
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  AiRecommendation: {
    create: jest.fn(),
  },
}));

// Mock imageService
jest.mock('../imageService', () => ({
  preprocessImage: jest.fn().mockResolvedValue({
    processedImage: Buffer.from('fake-processed-image'),
    metadata: {
      originalWidth: 1920,
      originalHeight: 1080,
      processedWidth: 800,
      processedHeight: 600,
      originalSizeKb: 2048,
      processedSizeKb: 150,
    },
  }),
}));

// Mock OpenAI - use a module-level variable that jest.mock can access via hoisting
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: (...args: any[]) => mockCreate(...args),
        },
      },
    })),
  };
});

// Mock fs
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock sequelize Op
jest.mock('sequelize', () => ({
  Op: {
    gte: Symbol('gte'),
    notIn: Symbol('notIn'),
  },
}));

import { RoomAssessment, ServiceRequest, BtuFactor, AirconProduct, AiRecommendation } from '../../models';
import * as fs from 'fs';

const mockedRoomAssessment = RoomAssessment as jest.Mocked<typeof RoomAssessment>;
const mockedServiceRequest = ServiceRequest as jest.Mocked<typeof ServiceRequest>;
const mockedBtuFactor = BtuFactor as jest.Mocked<typeof BtuFactor>;
const mockedAirconProduct = AirconProduct as jest.Mocked<typeof AirconProduct>;
const mockedAiRecommendation = AiRecommendation as jest.Mocked<typeof AiRecommendation>;

describe('aiService', () => {
  const validInput: CreateRoomAssessmentInput = {
    serviceRequestId: 1,
    userId: 1,
    area: 25.0,
    ceilingHeight: 3.0,
    occupancy: 5,
    sunlightLevel: 'moderate',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  // ─── Input Validation (createRoomAssessment) ─────────────────────────────

  describe('createRoomAssessment - input validation', () => {
    it('rejects missing area', async () => {
      const input = { ...validInput, area: undefined } as unknown as CreateRoomAssessmentInput;
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'area' }),
          ])
        );
      }
    });

    it('rejects area below minimum (< 1.0)', async () => {
      const input = { ...validInput, area: 0.5 };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'area', message: expect.stringContaining('between') }),
          ])
        );
      }
    });

    it('rejects area above maximum (> 1000.0)', async () => {
      const input = { ...validInput, area: 1001.0 };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'area', message: expect.stringContaining('between') }),
          ])
        );
      }
    });

    it('rejects missing ceilingHeight', async () => {
      const input = { ...validInput, ceilingHeight: undefined } as unknown as CreateRoomAssessmentInput;
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'ceilingHeight' }),
          ])
        );
      }
    });

    it('rejects ceilingHeight below minimum (< 1.0)', async () => {
      const input = { ...validInput, ceilingHeight: 0.5 };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'ceilingHeight', message: expect.stringContaining('between') }),
          ])
        );
      }
    });

    it('rejects ceilingHeight above maximum (> 10.0)', async () => {
      const input = { ...validInput, ceilingHeight: 11.0 };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'ceilingHeight', message: expect.stringContaining('between') }),
          ])
        );
      }
    });

    it('rejects missing occupancy', async () => {
      const input = { ...validInput, occupancy: undefined } as unknown as CreateRoomAssessmentInput;
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'occupancy' }),
          ])
        );
      }
    });

    it('rejects occupancy below minimum (< 1)', async () => {
      const input = { ...validInput, occupancy: 0 };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'occupancy', message: expect.stringContaining('between') }),
          ])
        );
      }
    });

    it('rejects occupancy above maximum (> 500)', async () => {
      const input = { ...validInput, occupancy: 501 };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'occupancy', message: expect.stringContaining('between') }),
          ])
        );
      }
    });

    it('rejects non-integer occupancy', async () => {
      const input = { ...validInput, occupancy: 3.5 };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'occupancy', message: expect.stringContaining('integer') }),
          ])
        );
      }
    });

    it('rejects missing sunlightLevel', async () => {
      const input = { ...validInput, sunlightLevel: '' };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'sunlightLevel' }),
          ])
        );
      }
    });

    it('rejects invalid sunlightLevel (not low/moderate/high)', async () => {
      const input = { ...validInput, sunlightLevel: 'extreme' };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'sunlightLevel', message: expect.stringContaining('one of') }),
          ])
        );
      }
    });

    it('rejects image with invalid mime type (not JPEG/PNG)', async () => {
      const input: CreateRoomAssessmentInput = {
        ...validInput,
        image: {
          buffer: Buffer.from('fake-image'),
          originalname: 'photo.gif',
          mimetype: 'image/gif',
          size: 1024,
        },
      };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'image', message: expect.stringContaining('JPEG or PNG') }),
          ])
        );
      }
    });

    it('rejects image exceeding 10MB', async () => {
      const input: CreateRoomAssessmentInput = {
        ...validInput,
        image: {
          buffer: Buffer.alloc(100),
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 11 * 1024 * 1024, // 11MB
        },
      };
      try {
        await createRoomAssessment(input);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'image', message: expect.stringContaining('10 MB') }),
          ])
        );
      }
    });

    it('accepts valid input with all required fields', async () => {
      (mockedServiceRequest.findOne as jest.Mock).mockResolvedValue({ id: 1, userId: 1 });
      (mockedRoomAssessment.create as jest.Mock).mockResolvedValue({
        id: 1,
        serviceRequestId: 1,
        area: 25.0,
        ceilingHeight: 3.0,
        occupancy: 5,
        sunlightLevel: 'moderate',
        imagePath: null,
        createdAt: new Date(),
      });

      const result = await createRoomAssessment(validInput);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.area).toBe(25.0);
    });
  });

  // ─── Room Assessment Creation ────────────────────────────────────────────

  describe('createRoomAssessment - record creation', () => {
    it('creates RoomAssessment record with correct data', async () => {
      (mockedServiceRequest.findOne as jest.Mock).mockResolvedValue({ id: 1, userId: 1 });
      (mockedRoomAssessment.create as jest.Mock).mockResolvedValue({
        id: 1,
        serviceRequestId: 1,
        area: 25.0,
        ceilingHeight: 3.0,
        occupancy: 5,
        sunlightLevel: 'moderate',
        imagePath: null,
        createdAt: new Date(),
      });

      await createRoomAssessment(validInput);

      expect(mockedRoomAssessment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceRequestId: 1,
          area: 25.0,
          ceilingHeight: 3.0,
          occupancy: 5,
          sunlightLevel: 'moderate',
          imagePath: null,
        })
      );
    });

    it('associates with user service request (verifies ServiceRequest.findOne called with userId and serviceRequestId)', async () => {
      (mockedServiceRequest.findOne as jest.Mock).mockResolvedValue({ id: 1, userId: 1 });
      (mockedRoomAssessment.create as jest.Mock).mockResolvedValue({
        id: 1,
        serviceRequestId: 1,
        area: 25.0,
        ceilingHeight: 3.0,
        occupancy: 5,
        sunlightLevel: 'moderate',
        imagePath: null,
        createdAt: new Date(),
      });

      await createRoomAssessment(validInput);

      expect(mockedServiceRequest.findOne).toHaveBeenCalledWith({
        where: {
          id: 1,
          userId: 1,
        },
      });
    });

    it('returns 404 if service request not found', async () => {
      (mockedServiceRequest.findOne as jest.Mock).mockResolvedValue(null);

      try {
        await createRoomAssessment(validInput);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toContain('Service request not found');
      }
    });

    it('saves image file when provided', async () => {
      const imageInput: CreateRoomAssessmentInput = {
        ...validInput,
        image: {
          buffer: Buffer.from('fake-image-data'),
          originalname: 'room.jpg',
          mimetype: 'image/jpeg',
          size: 5000,
        },
      };

      (mockedServiceRequest.findOne as jest.Mock).mockResolvedValue({ id: 1, userId: 1 });
      (mockedRoomAssessment.create as jest.Mock).mockResolvedValue({
        id: 1,
        serviceRequestId: 1,
        area: 25.0,
        ceilingHeight: 3.0,
        occupancy: 5,
        sunlightLevel: 'moderate',
        imagePath: 'uploads/room-images/some-file.jpg',
        createdAt: new Date(),
      });

      await createRoomAssessment(imageInput);

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('uploads'), { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('room-images'),
        imageInput.image!.buffer
      );
    });
  });

  // ─── Recommendation Parsing (generateRecommendation) ─────────────────────

  describe('generateRecommendation', () => {
    const mockRoomAssessment = {
      id: 1,
      serviceRequestId: 1,
      area: 25.0,
      ceilingHeight: 3.0,
      occupancy: 5,
      sunlightLevel: 'moderate',
      imagePath: null,
    };

    const mockBtuFactors = [
      { id: 1, factorName: 'base_btu_per_sqm', factorValue: 500, description: 'Base BTU per sq meter' },
      { id: 2, factorName: 'occupancy_factor', factorValue: 600, description: 'BTU per person' },
    ];

    const mockProducts = [
      {
        id: 1,
        brand: 'Daikin',
        model: 'FTKF25A',
        type: 'split-type',
        horsepower: 1.0,
        btuCapacity: 9000,
        price: 25000,
        description: 'Inverter split type',
        isActive: true,
      },
      {
        id: 2,
        brand: 'Carrier',
        model: 'XPower',
        type: 'window-type',
        horsepower: 1.5,
        btuCapacity: 12000,
        price: 18000,
        description: 'Window type AC',
        isActive: true,
      },
    ];

    const validOpenAIResponse = {
      total_btu: 15000,
      recommended_hp: 1.5,
      unit_type: 'split-type',
      reasoning: 'Based on room area of 25 sqm with moderate sunlight and 5 occupants.',
      troubleshooting_notes: null,
    };

    it('returns 404 if room assessment not found', async () => {
      (mockedRoomAssessment.findByPk as jest.Mock).mockResolvedValue(null);

      try {
        await generateRecommendation(999);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toContain('Room assessment not found');
      }
    });

    it('returns 422 if no BTU factors configured', async () => {
      (mockedRoomAssessment.findByPk as jest.Mock).mockResolvedValue(mockRoomAssessment);
      (mockedBtuFactor.findAll as jest.Mock).mockResolvedValue([]);

      try {
        await generateRecommendation(1);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.message).toContain('No BTU factors configured');
      }
    });

    it('returns 422 if no active products available', async () => {
      (mockedRoomAssessment.findByPk as jest.Mock).mockResolvedValue(mockRoomAssessment);
      (mockedBtuFactor.findAll as jest.Mock).mockResolvedValue(mockBtuFactors);
      (mockedAirconProduct.findAll as jest.Mock).mockResolvedValue([]);

      try {
        await generateRecommendation(1);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(422);
        expect(err.message).toContain('No active products available');
      }
    });

    it('successfully parses valid OpenAI recommendation JSON', async () => {
      (mockedRoomAssessment.findByPk as jest.Mock).mockResolvedValue(mockRoomAssessment);
      (mockedBtuFactor.findAll as jest.Mock).mockResolvedValue(mockBtuFactors);
      (mockedAirconProduct.findAll as jest.Mock).mockResolvedValue(mockProducts);
      (mockedAirconProduct.findOne as jest.Mock).mockResolvedValue(mockProducts[0]);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validOpenAIResponse) } }],
      });

      (mockedAiRecommendation.create as jest.Mock).mockResolvedValue({
        id: 1,
        roomAssessmentId: 1,
        totalBtu: 15000,
        recommendedHp: 1.5,
        unitType: 'split-type',
        productId: 1,
        troubleshootingNotes: null,
        reasoning: validOpenAIResponse.reasoning,
      });

      const result = await generateRecommendation(1);

      expect(result).toBeDefined();
      expect(result.totalBtu).toBe(15000);
      expect(result.recommendedHp).toBe(1.5);
      expect(result.unitType).toBe('split-type');
      expect(result.reasoning).toBe(validOpenAIResponse.reasoning);
    });

    it('matches recommendation to product by btu_capacity and type', async () => {
      (mockedRoomAssessment.findByPk as jest.Mock).mockResolvedValue(mockRoomAssessment);
      (mockedBtuFactor.findAll as jest.Mock).mockResolvedValue(mockBtuFactors);
      (mockedAirconProduct.findAll as jest.Mock).mockResolvedValue(mockProducts);
      (mockedAirconProduct.findOne as jest.Mock).mockResolvedValue(mockProducts[0]);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validOpenAIResponse) } }],
      });

      (mockedAiRecommendation.create as jest.Mock).mockResolvedValue({
        id: 1,
        roomAssessmentId: 1,
        totalBtu: 15000,
        recommendedHp: 1.5,
        unitType: 'split-type',
        productId: 1,
        troubleshootingNotes: null,
        reasoning: validOpenAIResponse.reasoning,
      });

      await generateRecommendation(1);

      expect(mockedAirconProduct.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'split-type',
            isActive: true,
          }),
          order: [['btu_capacity', 'ASC']],
        })
      );
    });

    it('saves AiRecommendation record with correct fields', async () => {
      (mockedRoomAssessment.findByPk as jest.Mock).mockResolvedValue(mockRoomAssessment);
      (mockedBtuFactor.findAll as jest.Mock).mockResolvedValue(mockBtuFactors);
      (mockedAirconProduct.findAll as jest.Mock).mockResolvedValue(mockProducts);
      (mockedAirconProduct.findOne as jest.Mock).mockResolvedValue(mockProducts[0]);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validOpenAIResponse) } }],
      });

      (mockedAiRecommendation.create as jest.Mock).mockResolvedValue({
        id: 1,
        roomAssessmentId: 1,
        totalBtu: 15000,
        recommendedHp: 1.5,
        unitType: 'split-type',
        productId: 1,
        troubleshootingNotes: null,
        reasoning: validOpenAIResponse.reasoning,
      });

      await generateRecommendation(1);

      expect(mockedAiRecommendation.create).toHaveBeenCalledWith({
        roomAssessmentId: 1,
        totalBtu: 15000,
        recommendedHp: 1.5,
        unitType: 'split-type',
        productId: 1,
        troubleshootingNotes: null,
        reasoning: validOpenAIResponse.reasoning,
      });
    });

    it('returns 502 if OpenAI returns empty response', async () => {
      (mockedRoomAssessment.findByPk as jest.Mock).mockResolvedValue(mockRoomAssessment);
      (mockedBtuFactor.findAll as jest.Mock).mockResolvedValue(mockBtuFactors);
      (mockedAirconProduct.findAll as jest.Mock).mockResolvedValue(mockProducts);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      try {
        await generateRecommendation(1);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(502);
        expect(err.message).toContain('empty response');
      }
    });

    it('returns 502 if OpenAI returns invalid JSON', async () => {
      (mockedRoomAssessment.findByPk as jest.Mock).mockResolvedValue(mockRoomAssessment);
      (mockedBtuFactor.findAll as jest.Mock).mockResolvedValue(mockBtuFactors);
      (mockedAirconProduct.findAll as jest.Mock).mockResolvedValue(mockProducts);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'This is not valid JSON at all' } }],
      });

      try {
        await generateRecommendation(1);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.statusCode).toBe(502);
        expect(err.message).toContain('invalid JSON');
      }
    });
  });
});
