import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { AiRecommendation, RoomAssessment, AirconProduct } from '../models';
import {
  createRoomAssessment,
  analyzeRoomImage,
  generateRecommendation,
  CombinedImageAnalysis,
} from '../services/aiService';
import {
  sendChatMessage,
  getSessionHistory,
  clearSession,
} from '../services/chatbotService';
import { diagnoseACIssue } from '../services/troubleshootingService';

export async function submitRoomAssessment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const { area, ceilingHeight, occupancy, sunlightLevel, serviceRequestId } = req.body;
    const file = req.file;

    const roomAssessment = await createRoomAssessment({
      userId: req.user.userId,
      serviceRequestId: serviceRequestId ? Number(serviceRequestId) : null,
      area: Number(area),
      ceilingHeight: Number(ceilingHeight),
      occupancy: Number(occupancy),
      sunlightLevel,
      image: file
        ? {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          }
        : undefined,
    });

    let recommendation;
    let opencvAnalysis = null;

    if (file) {
      // Run OpenCV + OpenAI Vision in parallel, then feed both into the recommendation
      const combinedAnalysis: CombinedImageAnalysis = await analyzeRoomImage(file.buffer, file.originalname);
      opencvAnalysis = combinedAnalysis.opencv;
      recommendation = await generateRecommendation(
        roomAssessment.id,
        combinedAnalysis.gemini,
        combinedAnalysis.opencv
      );
    } else {
      recommendation = await generateRecommendation(roomAssessment.id);
    }

    res.status(201).json({ roomAssessment, recommendation, opencvAnalysis });
  } catch (error) {
    next(error);
  }
}

export async function getRecommendation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const id = parseInt(req.params.id as string, 10);

    const recommendation = await AiRecommendation.findOne({
      where: { roomAssessmentId: id },
      include: [
        {
          model: RoomAssessment,
        },
        {
          model: AirconProduct,
        },
      ],
    });

    if (!recommendation) {
      res.status(404).json({ message: 'Recommendation not found' });
      return;
    }

    // Verify ownership via room assessment userId
    if (recommendation.roomAssessment?.userId !== req.user.userId) {
      res.status(404).json({ message: 'Recommendation not found' });
      return;
    }

    res.status(200).json({ recommendation });
  } catch (error) {
    next(error);
  }
}

export async function sendChatbotMessage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ message: 'Message is required and must be a non-empty string.' });
      return;
    }

    if (message.length > 1000) {
      res.status(400).json({ message: 'Message must not exceed 1000 characters.' });
      return;
    }

    const responseText = await sendChatMessage(req.user.userId, message.trim());
    const history = getSessionHistory(req.user.userId);

    res.status(200).json({ message: responseText, history });
  } catch (error) {
    next(error);
  }
}

export async function getChatbotHistory(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const history = getSessionHistory(req.user.userId);

    res.status(200).json({ history });
  } catch (error) {
    next(error);
  }
}

export async function clearChatbotSession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    clearSession(req.user.userId);

    res.status(200).json({ message: 'Chat session cleared successfully.' });
  } catch (error) {
    next(error);
  }
}

export async function submitTroubleshooting(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const { issue, acType, brand, model } = req.body;

    // Parse symptoms from form data (sent as symptoms[] array)
    let symptoms: string[] | undefined;
    if (req.body.symptoms) {
      symptoms = Array.isArray(req.body.symptoms) ? req.body.symptoms : [req.body.symptoms];
    } else if (req.body['symptoms[]']) {
      symptoms = Array.isArray(req.body['symptoms[]']) ? req.body['symptoms[]'] : [req.body['symptoms[]']];
    }

    if (!issue || typeof issue !== 'string' || issue.trim().length === 0) {
      res.status(400).json({ message: 'Issue description is required.' });
      return;
    }

    if (issue.length > 2000) {
      res.status(400).json({ message: 'Issue description must not exceed 2000 characters.' });
      return;
    }

    const file = req.file;

    const result = await diagnoseACIssue({
      issue: issue.trim(),
      acType: acType?.trim() || undefined,
      brand: brand?.trim() || undefined,
      model: model?.trim() || undefined,
      symptoms: symptoms || undefined,
      image: file
        ? { buffer: file.buffer, mimetype: file.mimetype }
        : undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
