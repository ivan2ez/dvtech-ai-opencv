import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { AiRecommendation, RoomAssessment, ServiceRequest, AirconProduct } from '../models';
import {
  createRoomAssessment,
  analyzeRoomImage,
  generateRecommendation,
} from '../services/aiService';
import {
  sendChatMessage,
  getSessionHistory,
  clearSession,
} from '../services/chatbotService';

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

    const { serviceRequestId, area, ceilingHeight, occupancy, sunlightLevel } = req.body;
    const file = req.file;

    const roomAssessment = await createRoomAssessment({
      serviceRequestId: Number(serviceRequestId),
      userId: req.user.userId,
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
    if (file) {
      const imageAnalysis = await analyzeRoomImage(file.buffer, file.originalname);
      recommendation = await generateRecommendation(roomAssessment.id, imageAnalysis);
    } else {
      recommendation = await generateRecommendation(roomAssessment.id);
    }

    res.status(201).json({ roomAssessment, recommendation });
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
          include: [
            {
              model: ServiceRequest,
              attributes: ['userId'],
            },
          ],
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

    // Verify ownership: recommendation → roomAssessment → serviceRequest → userId
    const roomAssessment = recommendation.roomAssessment;
    const serviceRequest = roomAssessment?.serviceRequest;

    if (!serviceRequest || serviceRequest.userId !== req.user.userId) {
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
