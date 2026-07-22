import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Validation error handler middleware.
 * Catches express-validator validation results and returns structured 400 responses.
 * Use this middleware AFTER validation chain arrays in route definitions.
 */
export function handleValidationErrors(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const fieldErrors = errors.array().map((err) => {
      if (err.type === 'field') {
        return {
          field: err.path,
          message: err.msg,
        };
      }
      return {
        field: 'unknown',
        message: err.msg,
      };
    });

    res.status(400).json({
      message: 'Validation failed',
      errors: fieldErrors,
    });
    return;
  }

  next();
}
