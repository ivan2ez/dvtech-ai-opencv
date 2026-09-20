import { Router } from 'express';
import {
  registerHandler,
  loginHandler,
  getProfileHandler,
  updateProfileHandler,
  changePasswordHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  requestRegistrationOtpHandler,
  requestProfileGmailOtpHandler,
} from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { handleValidationErrors } from '../middlewares/validationMiddleware';
import {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  requestGmailOtpValidation,
  requestRegistrationOtpValidation,
} from '../utils/validators';

const router = Router();

// Public routes
// Step 1 of registration: email the 6-digit Gmail verification code.
router.post(
  '/register/gmail-otp',
  requestRegistrationOtpValidation,
  handleValidationErrors,
  requestRegistrationOtpHandler
);
// Step 2: create the account, which requires the code from step 1.
router.post('/register', registerValidation, handleValidationErrors, registerHandler);
router.post('/login', loginValidation, handleValidationErrors, loginHandler);
router.post('/forgot-password', forgotPasswordValidation, handleValidationErrors, forgotPasswordHandler);
router.post('/reset-password', resetPasswordValidation, handleValidationErrors, resetPasswordHandler);

// Protected routes
router.get('/profile', authMiddleware, getProfileHandler);
// Emails a verification code for a Gmail change; PUT /profile then applies it.
router.post(
  '/profile/gmail-otp',
  authMiddleware,
  requestGmailOtpValidation,
  handleValidationErrors,
  requestProfileGmailOtpHandler
);
router.put('/profile', authMiddleware, updateProfileValidation, handleValidationErrors, updateProfileHandler);
router.put('/password', authMiddleware, changePasswordValidation, handleValidationErrors, changePasswordHandler);

export default router;
