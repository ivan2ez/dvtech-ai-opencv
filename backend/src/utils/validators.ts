import { body, param, query } from 'express-validator';
import { QUOTATION_STATUS_VALUES } from '../constants/quotationStatus';

// Contact numbers must be exactly 11 digits (e.g. Philippine mobile: 09171234567).
const CONTACT_NUMBER_REGEX = /^\d{11}$/;

// Gmail verification codes are exactly 6 digits.
const OTP_CODE_REGEX = /^\d{6}$/;

// The verified notification address must live on a Gmail domain. The deeper
// checks (and the canonical error copy) live in verificationService.validateGmail;
// this keeps obviously malformed input out of the service layer.
const gmailValidation = [
  body('gmail')
    .trim()
    .notEmpty()
    .withMessage('Gmail address is required')
    .isEmail()
    .withMessage('Enter a valid email address')
    .bail()
    .matches(/@(gmail|googlemail)\.com$/i)
    .withMessage('Must be a Gmail address (e.g. you@gmail.com)'),
];

/** Validation for the endpoints that email a Gmail verification code. */
export const requestGmailOtpValidation = [...gmailValidation];

/** Validation for POST /api/auth/register/gmail-otp (email checked too). */
export const requestRegistrationOtpValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  ...gmailValidation,
];

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
  ...gmailValidation,
  body('gmailOtp')
    .trim()
    .matches(OTP_CODE_REGEX)
    .withMessage('Enter the 6-digit code sent to your Gmail'),
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
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  ...gmailValidation,
  // Only required when the Gmail address actually changes; the controller
  // enforces that, so here we only check the shape when a value is present.
  body('gmailOtp')
    .optional({ values: 'falsy' })
    .trim()
    .matches(OTP_CODE_REGEX)
    .withMessage('Enter the 6-digit code sent to your Gmail'),
  body('street')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Street must not exceed 255 characters'),
  body('barangay')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Barangay must not exceed 255 characters'),
  body('city')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('City must not exceed 255 characters'),
  body('province')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Province must not exceed 255 characters'),
  body('contactNumber')
    .optional({ nullable: true })
    .trim()
    // Only enforce format when a non-empty value is provided (empty clears it).
    .if((value: string) => typeof value === 'string' && value.trim().length > 0)
    .matches(CONTACT_NUMBER_REGEX)
    .withMessage('Contact number must be exactly 11 digits'),
];

/**
 * Validation schema for PUT /api/auth/password
 * - currentPassword: non-empty
 * - newPassword: 8-128 chars, at least 1 uppercase, 1 lowercase, 1 digit
 */
export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('New password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('New password must contain at least one digit'),
];

/**
 * Validation schema for POST /api/auth/forgot-password
 * - email: valid email format
 */
export const forgotPasswordValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
];

/**
 * Validation schema for POST /api/auth/reset-password
 * - token: non-empty
 * - newPassword: 8-128 chars, at least 1 uppercase, 1 lowercase, 1 digit
 */
export const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('New password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('New password must contain at least one digit'),
];

// ─── Service Request Validators ────────────────────────────────────────────────

/**
 * Validation schema for POST /api/service-requests
 * - serviceType: non-empty service name (validated against active services in the service layer)
 * - acDetails: non-empty, max 1000 chars
 */
export const createServiceRequestValidation = [
  body('serviceType')
    .trim()
    .notEmpty()
    .withMessage('Service type is required')
    .isLength({ max: 100 })
    .withMessage('Service type must not exceed 100 characters'),
  body('acDetails')
    .trim()
    .notEmpty()
    .withMessage('AC details are required')
    .isLength({ max: 1000 })
    .withMessage('AC details must not exceed 1000 characters'),
  body('serviceStreet')
    .trim()
    .notEmpty()
    .withMessage('Street is required')
    .isLength({ max: 255 })
    .withMessage('Street must not exceed 255 characters'),
  body('serviceBarangay')
    .trim()
    .notEmpty()
    .withMessage('Barangay is required')
    .isLength({ max: 255 })
    .withMessage('Barangay must not exceed 255 characters'),
  body('serviceCity')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: 255 })
    .withMessage('City must not exceed 255 characters'),
  body('serviceProvince')
    .trim()
    .notEmpty()
    .withMessage('Province is required')
    .isLength({ max: 255 })
    .withMessage('Province must not exceed 255 characters'),
  body('contactNumber')
    .trim()
    .notEmpty()
    .withMessage('Contact number is required')
    .matches(CONTACT_NUMBER_REGEX)
    .withMessage('Contact number must be exactly 11 digits'),
  // Optional AC selection — only relevant for Installation requests.
  body('installBrand')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Brand must not exceed 100 characters'),
  body('installModel')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Model must not exceed 100 characters'),
  body('serviceRequiredDate')
    .trim()
    .notEmpty()
    .withMessage('Service required date is required')
    .isISO8601()
    .withMessage('Service required date must be a valid date')
    .custom((value: string) => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (String(value).trim() < todayStr) {
        throw new Error('Service required date must be today or later');
      }
      return true;
    }),
  // Paired with the date to form the admin's "Required Date and Time".
  body('serviceRequiredTime')
    .trim()
    .notEmpty()
    .withMessage('Preferred time is required')
    .isIn(['morning', 'afternoon'])
    .withMessage('Preferred time must be either morning or afternoon'),
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

/**
 * Validation schema for PATCH /api/service-requests/:id/reschedule (admin)
 * The proposed technician is optional: the admin may offer a new date without
 * committing to who will take it.
 */
export const proposeRescheduleValidation = [
  body('proposedDate')
    .trim()
    .notEmpty()
    .withMessage('New date is required')
    .isISO8601()
    .withMessage('New date must be a valid date'),
  body('proposedTime')
    .trim()
    .isIn(['morning', 'afternoon'])
    .withMessage('New time must be either morning or afternoon'),
  body('proposedTechnicianId')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('Technician ID must be a positive integer'),
  body('reason')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
];

/**
 * Validation schema for PATCH /api/service-requests/:id/reschedule/respond
 * Notes are optional and only meaningful when declining.
 */
export const respondToRescheduleValidation = [
  body('action')
    .trim()
    .isIn(['accept', 'decline'])
    .withMessage("Action must be either 'accept' or 'decline'"),
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must not exceed 500 characters'),
];

// ─── Quotation Validators ──────────────────────────────────────────────────────

/**
 * Validation schema for POST /api/quotations (customer creates a quotation).
 * - brand: required, max 100 chars
 * - model: required, max 100 chars
 * - details: optional (nullable), max 2000 chars
 */
export const createQuotationValidation = [
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
  body('details')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Details must not exceed 2000 characters'),
];

/**
 * Validation schema for PATCH /api/quotations/:id/status (admin transition).
 * The status must be one of the single-sourced placeholder vocabulary values
 * (Req 5); anything else is rejected as a 400.
 */
export const updateQuotationStatusValidation = [
  body('status')
    .isIn(QUOTATION_STATUS_VALUES)
    .withMessage(`Status must be one of: ${QUOTATION_STATUS_VALUES.join(', ')}`),
];

// ─── Admin Technician Validators ───────────────────────────────────────────────

// Shared optional address-part validators for technician create/update.
const technicianAddressValidation = [
  body('street').optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage('Street must not exceed 255 characters'),
  body('barangay').optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage('Barangay must not exceed 255 characters'),
  body('city').optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage('City must not exceed 255 characters'),
  body('province').optional({ nullable: true }).trim().isLength({ max: 255 }).withMessage('Province must not exceed 255 characters'),
];

/**
 * Validation schema for POST /api/admin/technicians
 * Body fields are camelCase (contactNumber, availabilityStatus).
 */
export const createTechnicianValidation = [
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
  body('specialization')
    .trim()
    .notEmpty()
    .withMessage('Specialization is required')
    .isLength({ max: 100 })
    .withMessage('Specialization must not exceed 100 characters'),
  body('contactNumber')
    .trim()
    .notEmpty()
    .withMessage('Contact number is required')
    .isLength({ max: 50 })
    .withMessage('Contact number must not exceed 50 characters')
    .matches(CONTACT_NUMBER_REGEX)
    .withMessage('Contact number may only contain digits and + ( ) - characters'),
  ...technicianAddressValidation,
];

/**
 * Validation schema for PUT /api/admin/technicians/:id
 * All fields optional but validated if present.
 */
export const updateTechnicianValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('specialization')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Specialization cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Specialization must not exceed 100 characters'),
  body('contactNumber')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Contact number cannot be empty')
    .isLength({ max: 50 })
    .withMessage('Contact number must not exceed 50 characters')
    .matches(CONTACT_NUMBER_REGEX)
    .withMessage('Contact number may only contain digits and + ( ) - characters'),
  body('availabilityStatus')
    .optional()
    .trim()
    .isIn(['available', 'unavailable'])
    .withMessage('Availability status must be one of: available, unavailable'),
  ...technicianAddressValidation,
];

// ─── Room Assessment Validators ────────────────────────────────────────────────

/**
 * Validation schema for POST /api/ai/room-assessment
 *
 * Per the revisions, area / ceiling height / occupancy have NO upper limit —
 * only letters and negative numbers are rejected. dailyUsage is hours per day,
 * capped at 24. Sunlight accepts low/medium/moderate/high.
 */
export const roomAssessmentValidation = [
  ...unboundedPositiveNumber('area', 'Area'),
  ...unboundedPositiveNumber('ceilingHeight', 'Ceiling height'),
  ...unboundedPositiveNumber('occupancy', 'Occupancy', { integerOnly: true }),
  body('sunlightLevel')
    .trim()
    .isIn(['low', 'medium', 'moderate', 'high'])
    .withMessage('Sunlight level must be one of: low, medium, high'),
  // Hours of use per day (0-24). Optional so older clients keep working.
  body('dailyUsage')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 24 })
    .withMessage('Daily usage must be between 0 and 24 hours'),
];

// ─── Product Validators ────────────────────────────────────────────────────────

/**
 * Validation chain for a numeric field with no upper bound.
 *
 * Product horsepower, BTU capacity and price must cover commercial units, so
 * capping them would reject legitimate catalog entries. The only rejections are
 * values that aren't numbers (letters) and negative numbers.
 */
function unboundedPositiveNumber(
  field: string,
  label: string,
  options: { integerOnly?: boolean; optional?: boolean } = {}
) {
  let chain = body(field);

  if (options.optional) {
    chain = chain.optional();
  }

  chain = chain
    .not()
    .isArray()
    .withMessage(`${label} must be a number`)
    .bail()
    // `isFloat`/`isInt` with only a `min` enforces "numeric and not negative"
    // without imposing a ceiling.
    .custom((value: unknown) => {
      const numeric = Number(value);
      if (value === null || value === '' || Number.isNaN(numeric)) {
        throw new Error(`${label} must be a number`);
      }
      if (!Number.isFinite(numeric)) {
        throw new Error(`${label} must be a valid number`);
      }
      if (numeric < 0) {
        throw new Error(`${label} cannot be negative`);
      }
      if (numeric === 0) {
        throw new Error(`${label} must be greater than 0`);
      }
      if (options.integerOnly && !Number.isInteger(numeric)) {
        throw new Error(`${label} must be a whole number`);
      }
      return true;
    });

  return [chain];
}

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
  body('unitType')
    .trim()
    .isIn(['inverter', 'non-inverter'])
    .withMessage('Unit type must be either inverter or non-inverter'),
  ...unboundedPositiveNumber('horsepower', 'Horsepower'),
  ...unboundedPositiveNumber('btuCapacity', 'BTU capacity', { integerOnly: true }),
  ...unboundedPositiveNumber('price', 'Price'),
  body('sortWeight')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort weight must be a whole number of 0 or more'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('imageUrl')
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
  body('unitType')
    .optional()
    .trim()
    .isIn(['inverter', 'non-inverter'])
    .withMessage('Unit type must be either inverter or non-inverter'),
  ...unboundedPositiveNumber('horsepower', 'Horsepower', { optional: true }),
  ...unboundedPositiveNumber('btuCapacity', 'BTU capacity', {
    integerOnly: true,
    optional: true,
  }),
  ...unboundedPositiveNumber('price', 'Price', { optional: true }),
  body('sortWeight')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort weight must be a whole number of 0 or more'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('imageUrl')
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
  body('technicianId')
    .isInt({ min: 1 })
    .withMessage('Technician ID must be a positive integer'),
  body('serviceRequestId')
    .isInt({ min: 1 })
    .withMessage('Service request ID must be a positive integer'),
  body('scheduledDate')
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
 * - factor_value: any positive number, no upper limit (reject only letters/negatives)
 * - description: optional, max 500 chars
 *
 * The upper cap was removed per the revisions: appliance adders like a microwave
 * (+1000) or server rack (+1000) far exceed the old 100 ceiling, which was the
 * cause of the "FAILED TO SAVE BTU FACTOR" error.
 */
export const createBtuFactorValidation = [
  body('factorName')
    .trim()
    .notEmpty()
    .withMessage('Factor name is required')
    .isLength({ max: 100 })
    .withMessage('Factor name must not exceed 100 characters'),
  ...unboundedPositiveNumber('factorValue', 'Factor value'),
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
  body('factorName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Factor name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Factor name must not exceed 100 characters'),
  ...unboundedPositiveNumber('factorValue', 'Factor value', { optional: true }),
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
