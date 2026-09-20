import { Request, Response, NextFunction } from 'express';

// ─── Typed Error Classes ───────────────────────────────────────────────────────

/**
 * Base application error class. All typed errors extend this.
 * Includes a statusCode for HTTP response mapping and an optional errors array
 * for field-level validation details.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    statusCode: number,
    errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 400 Bad Request — input validation failures */
export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation failed',
    errors?: Array<{ field: string; message: string }>
  ) {
    super(message, 400, errors);
  }
}

/** 401 Unauthorized — missing or invalid authentication */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

/** 403 Forbidden — authenticated but insufficient permissions */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
  }
}

/** 404 Not Found — requested resource does not exist */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/** 409 Conflict — request conflicts with current state (e.g. duplicate) */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}

// ─── User-Facing Messages ──────────────────────────────────────────────────────

/**
 * Maps HTTP status codes to generic user-facing messages.
 * Internal error details are never exposed to the client.
 */
const USER_MESSAGES: Record<number, string> = {
  400: 'The request contains invalid data. Please check your input and try again.',
  401: 'Authentication is required. Please log in and try again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'The request conflicts with the current state. Please try again.',
  422: 'The request could not be processed. Please verify your input.',
  423: 'The resource is temporarily locked. Please try again later.',
  500: 'An unexpected error occurred. Please try again later.',
  502: 'A downstream service is temporarily unavailable. Please try again later.',
  503: 'The service is temporarily unavailable. Please try again later.',
};

// ─── Error Logger ──────────────────────────────────────────────────────────────

interface ErrorLogContext {
  timestamp: string;
  errorType: string;
  message: string;
  statusCode: number;
  method: string;
  path: string;
  stack?: string;
}

/**
 * Logs errors with contextual information.
 * Stack traces are included only for 500-level errors.
 */
function logError(err: Error, req: Request, statusCode: number): void {
  const context: ErrorLogContext = {
    timestamp: new Date().toISOString(),
    errorType: err.constructor.name,
    message: err.message,
    statusCode,
    method: req.method,
    path: req.originalUrl || req.path,
  };

  // Include stack trace only for server errors (5xx)
  if (statusCode >= 500) {
    context.stack = err.stack;
  }

  console.error('[ERROR]', JSON.stringify(context, null, 2));
}

// ─── Global Error Handling Middleware ──────────────────────────────────────────

/**
 * Global Express error handling middleware.
 * - Catches typed AppError instances and maps to appropriate HTTP responses
 * - Catches legacy errors with statusCode property (backward compatible)
 * - Logs all errors with context
 * - Returns generic user-facing messages (never exposes internal details for 5xx)
 */
export function errorMiddleware(
  err: Error & { statusCode?: number; errors?: Array<{ field: string; message: string }> },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode: number;
  let userMessage: string;
  let fieldErrors: Array<{ field: string; message: string }> | undefined;

  if (err instanceof AppError) {
    // Typed application error
    statusCode = err.statusCode;
    fieldErrors = err.errors;
    // For client errors (4xx), use the specific error message
    // For server errors (5xx), use a generic message
    userMessage = statusCode < 500
      ? err.message
      : (USER_MESSAGES[statusCode] || USER_MESSAGES[500]);
  } else if (err.statusCode) {
    // Legacy error pattern (backward compatible with existing services)
    statusCode = err.statusCode;
    fieldErrors = err.errors;
    userMessage = statusCode < 500
      ? err.message
      : (USER_MESSAGES[statusCode] || USER_MESSAGES[500]);
  } else {
    // Completely unknown error — treat as 500
    statusCode = 500;
    userMessage = USER_MESSAGES[500];
  }

  // Log with context
  logError(err, req, statusCode);

  // Build response body
  const responseBody: {
    message: string;
    errors?: Array<{ field: string; message: string }>;
  } = { message: userMessage };

  // Include field-level errors for validation failures
  if (fieldErrors && fieldErrors.length > 0) {
    responseBody.errors = fieldErrors;
  }

  res.status(statusCode).json(responseBody);
}
