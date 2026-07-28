import { Router } from 'express';
import multer from 'multer';
import {
  submitRoomAssessment,
  getRecommendation,
  sendChatbotMessage,
  getChatbotHistory,
  clearChatbotSession,
  submitTroubleshooting,
} from '../controllers/aiController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import {
  roomAssessmentValidation,
  chatbotMessageValidation,
} from '../utils/validators';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Customer submits a room assessment (with optional image upload)
router.post(
  '/room-assessment',
  authMiddleware,
  roleMiddleware('customer'),
  upload.single('image'),
  roomAssessmentValidation,
  handleValidationErrors,
  submitRoomAssessment
);

// Customer retrieves a recommendation by room assessment ID
router.get(
  '/recommendations/:id',
  authMiddleware,
  roleMiddleware('customer'),
  getRecommendation
);

// Customer sends a chatbot message
router.post(
  '/chatbot',
  authMiddleware,
  roleMiddleware('customer'),
  chatbotMessageValidation,
  handleValidationErrors,
  sendChatbotMessage
);

// Customer retrieves chatbot history
router.get(
  '/chatbot/history',
  authMiddleware,
  roleMiddleware('customer'),
  getChatbotHistory
);

// Customer clears chatbot session
router.delete(
  '/chatbot/session',
  authMiddleware,
  roleMiddleware('customer'),
  clearChatbotSession
);

// Customer submits an AC troubleshooting request (with optional image)
router.post(
  '/troubleshoot',
  authMiddleware,
  roleMiddleware('customer'),
  upload.single('image'),
  submitTroubleshooting
);

export default router;
