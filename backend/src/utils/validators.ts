import { body, param, query } from 'express-validator';

// ─── Authentication Validators ─────────────────────────────────────────────────

/**
 * Validation schema for POST /api/auth/register
 * - name: 2-100 characters
 * - email: valid email format
 * - password: 8-128 chars, at least 1 uppercase, 1 lowercase, 1 digit
 */
export const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one digit'),
];

/**
 * Validation schema for POST /api/auth/login
 * - email: valid email format
 * - password: non-empty
 */
export const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * Validation schema for PUT /api/auth/profile
 * - name: 1-100 characters (optional but validated if present)
 * - email: valid email format (optional but validated if present)
 */
export const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
];

// ─── Service Request Validators ────────────────────────────────────────────────

/**
 * Validation schema for POST /api/service-requests
 * - service_type: one of installation, maintenance, repair
 * - ac_details: non-empty, max 1000 chars
 */
export const createServiceRequestValidation = [
  body('service_type')
    .trim()
    .isIn(['installation', 'maintenance', 'repair'])
    .withMessage('Service type must be one of: installation, maintenance, repair'),
  body('ac_details')
    .trim()
    .notEmpty()
    .withMessage('AC details are required')
    .isLength({ max: 1000 })
    .withMessage('AC details must not exceed 1000 characters'),
];

/**
 * Validation schema for PATCH /api/service-requests/:id/reject
 * - reason: 10-500 characters
 */
export const rejectServiceRequestValidation = [
  body('reason')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason must be between 10 and 500 characters'),
];

// ─── Room Assessment Validators ────────────────────────────────────────────────

/**
 * Validation schema for POST /api/ai/room-assessment
 * - area: 1.0-1000.0 float
 * - ceiling_height: 1.0-10.0 float
 * - occupancy: 1-500 integer
 * - sunlight_level: one of low, moderate, high
 */
export const roomAssessmentValidation = [
  body('area')
    .isFloat({ min: 1.0, max: 1000.0 })
    .withMessage('Area must be a number between 1.0 and 1000.0 square meters'),
  body('ceilingHeight')
    .isFloat({ min: 1.0, max: 10.0 })
    .withMessage('Ceiling height must be a number between 1.0 and 10.0 meters'),
  body('occupancy')
    .isInt({ min: 1, max: 500 })
    .withMessage('Occupancy must be an integer between 1 and 500'),
  body('sunlightLevel')
    .trim()
    .isIn(['low', 'moderate', 'high'])
    .withMessage('Sunlight level must be one of: low, moderate, high'),
];

// ─── Product Validators ────────────────────────────────────────────────────────

/**
 * Validation schema for POST /api/products and PUT /api/products/:id
 * - brand: non-empty, max 100 chars
 * - model: non-empty, max 100 chars
 * - type: one of split-type, window-type, floor-standing
 * - horsepower: 0.5-10
 * - btu_capacity: 5000-60000 integer
 * - price: 0.01-999999.99
 */
export const createProductValidation = [
  body('brand')
    .trim()
    .notEmpty()
    .withMessage('Brand is required')
    .isLength({ max: 100 })
    .withMessage('Brand must not exceed 100 characters'),
  body('model')
    .trim()
    .notEmpty()
    .withMessage('Model is required')
    .isLength({ max: 100 })
    .withMessage('Model must not exceed 100 characters'),
  body('type')
    .trim()
    .isIn(['split-type', 'window-type', 'floor-standing'])
    .withMessage('Type must be one of: split-type, window-type, floor-standing'),
  body('horsepower')
    .isFloat({ min: 0.5, max: 10 })
    .withMessage('Horsepower must be a number between 0.5 and 10'),
  body('btu_capacity')
    .isInt({ min: 5000, max: 60000 })
    .withMessage('BTU capacity must be an integer between 5000 and 60000'),
  body('price')
    .isFloat({ min: 0.01, max: 999999.99 })
    .withMessage('Price must be a number between 0.01 and 999999.99'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('image_url')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Image URL must not exceed 500 characters'),
];

/**
 * Validation schema for PUT /api/products/:id (update)
 * All fields are optional but validated if present
 */
export const updateProductValidation = [
  body('brand')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Brand cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Brand must not exceed 100 characters'),
  body('model')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Model cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Model must not exceed 100 characters'),
  body('type')
    .optional()
    .trim()
    .isIn(['split-type', 'window-type', 'floor-standing'])
    .withMessage('Type must be one of: split-type, window-type, floor-standing'),
  body('horsepower')
    .optional()
    .isFloat({ min: 0.5, max: 10 })
    .withMessage('Horsepower must be a number between 0.5 and 10'),
  body('btu_capacity')
    .optional()
    .isInt({ min: 5000, max: 60000 })
    .withMessage('BTU capacity must be an integer between 5000 and 60000'),
  body('price')
    .optional()
    .isFloat({ min: 0.01, max: 999999.99 })
    .withMessage('Price must be a number between 0.01 and 999999.99'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('image_url')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Image URL must not exceed 500 characters'),
];

// ─── Schedule Validators ───────────────────────────────────────────────────────

/**
 * Validation schema for POST /api/schedules (assign technician)
 * - technician_id: integer
 * - service_request_id: integer
 * - scheduled_date: valid date, not in the past
 * - priority: one of low, medium, high (optional, defaults to medium)
 */
export const assignScheduleValidation = [
  body('technician_id')
    .isInt({ min: 1 })
    .withMessage('Technician ID must be a positive integer'),
  body('service_request_id')
    .isInt({ min: 1 })
    .withMessage('Service request ID must be a positive integer'),
  body('scheduled_date')
    .isISO8601({ strict: true })
    .withMessage('Scheduled date must be a valid date (ISO 8601 format)')
    .custom((value: string) => {
      const scheduledDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (scheduledDate < today) {
        throw new Error('Scheduled date must not be in the past');
      }
      return true;
    }),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be one of: low, medium, high'),
];

/**
 * Validation schema for PATCH /api/schedules/:id/reject
 * - reason: minimum 10 characters
 */
export const rejectTaskValidation = [
  body('reason')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Rejection reason must be at least 10 characters'),
];

/**
 * Validation schema for PATCH /api/schedules/:id/complete
 * - report: minimum 20 characters
 */
export const completeTaskValidation = [
  body('report')
    .trim()
    .isLength({ min: 20 })
    .withMessage('Completion report must be at least 20 characters'),
];

// ─── BTU Factor Validators ─────────────────────────────────────────────────────

/**
 * Validation schema for POST /api/btu-factors
 * - factor_name: non-empty, max 100 chars
 * - factor_value: 0.01-100.00
 * - description: optional, max 500 chars
 */
export const createBtuFactorValidation = [
  body('factor_name')
    .trim()
    .notEmpty()
    .withMessage('Factor name is required')
    .isLength({ max: 100 })
    .withMessage('Factor name must not exceed 100 characters'),
  body('factor_value')
    .isFloat({ min: 0.01, max: 100.0 })
    .withMessage('Factor value must be a number between 0.01 and 100.00'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
];

/**
 * Validation schema for PUT /api/btu-factors/:id
 * All fields optional but validated if present
 */
export const updateBtuFactorValidation = [
  body('factor_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Factor name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Factor name must not exceed 100 characters'),
  body('factor_value')
    .optional()
    .isFloat({ min: 0.01, max: 100.0 })
    .withMessage('Factor value must be a number between 0.01 and 100.00'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
];

// ─── Chatbot Validators ────────────────────────────────────────────────────────

/**
 * Validation schema for POST /api/ai/chatbot
 * - message: non-empty, max 2000 chars
 */
export const chatbotMessageValidation = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 2000 })
    .withMessage('Message must not exceed 2000 characters'),
];

// ─── Common Parameter Validators ───────────────────────────────────────────────

/**
 * Validation for route parameter :id (integer)
 */
export const idParamValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),
];
