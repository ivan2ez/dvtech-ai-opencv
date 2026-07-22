import { Router } from 'express';
import {
  registerHandler,
  loginHandler,
  getProfileHandler,
  updateProfileHandler,
} from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import {
  registerValidation,
  loginValidation,
  updateProfileValidation,
} from '../utils/validators';

const router = Router();

// Public routes
router.post('/register', registerValidation, handleValidationErrors, registerHandler);
router.post('/login', loginValidation, handleValidationErrors, loginHandler);

// Protected routes
router.get('/profile', authMiddleware, getProfileHandler);
router.put('/profile', authMiddleware, updateProfileValidation, handleValidationErrors, updateProfileHandler);

export default router;
