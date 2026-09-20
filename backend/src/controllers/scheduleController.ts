import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Response, NextFunction } from 'express';
import multer from 'multer';
import { AuthenticatedRequest } from '../types';
import * as scheduleService from '../services/scheduleService';
import * as availabilityService from '../services/availabilityService';

const COMPLETION_PHOTO_DIR = process.env.VERCEL === '1'
  ? '/tmp/uploads/completion-photos'
  : path.resolve(__dirname, '../../uploads/completion-photos');

// ── Completion-photo multipart constraints (Req 17.6, 17.7) ──
//
// The completion route accepts one photo up to 5 MB whose type is JPEG/PNG/WEBP.
// Multer is configured with memory storage so nothing is written to disk until
// every validation step in `completeTaskHandler` has passed (the photo is only
// persisted AFTER validation, Req 17.1). The size limit is enforced by multer;
// an oversized upload surfaces as a `LIMIT_FILE_SIZE` error which the handler
// maps to 413. Disallowed types are flagged by the fileFilter (below) and
// mapped to 415.
const COMPLETION_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB (Req 17.6)
const ALLOWED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/**
 * Multer instance scoped to the completion route. Memory storage keeps the
 * buffer in RAM so we can defer writing the file until after validation. The
 * 5 MB limit means an oversized photo produces a `LIMIT_FILE_SIZE` MulterError
 * rather than the generic 10 MB image ceiling used elsewhere (Req 17.6).
 */
const completionPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: COMPLETION_PHOTO_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    // Flag but do not throw here — the handler decides the response code and
    // ordering. A disallowed type is recorded on the request so the handler can
    // return 415 at the correct point in the validation order (Req 17.7).
    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.mimetype)) {
      const err = new Error(
        'Completion photo must be a JPEG, PNG, or WEBP image'
      ) as multer.MulterError & { code: string };
      err.code = 'UNSUPPORTED_MEDIA_TYPE' as multer.MulterError['code'];
      cb(err);
      return;
    }
    cb(null, true);
  },
});

const runCompletionPhotoUpload = completionPhotoUpload.single('photo');

/**
 * Runs the completion-photo multer middleware and resolves with any multer
 * error instead of rejecting, so the handler can decide where that error falls
 * in the validation order (Req 17.3, 17.4, 17.6, 17.7). This is what lets the
 * handler report a missing field or a bad report length BEFORE surfacing a
 * size/type problem.
 */
function parseCompletionMultipart(
  req: AuthenticatedRequest,
  res: Response
): Promise<multer.MulterError | Error | null> {
  return new Promise((resolve) => {
    runCompletionPhotoUpload(req as never, res as never, (err: unknown) => {
      if (err) {
        resolve(err as multer.MulterError | Error);
        return;
      }
      resolve(null);
    });
  });
}

function saveCompletionPhoto(file: Express.Multer.File): string {
  fs.mkdirSync(COMPLETION_PHOTO_DIR, { recursive: true });
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(COMPLETION_PHOTO_DIR, filename), file.buffer);
  return `uploads/completion-photos/${filename}`;
}

/** Throws a typed error the global error middleware maps to the given status. */
function httpError(
  message: string,
  statusCode: number,
  errors?: Array<{ field: string; message: string }>
): Error & { statusCode: number; errors?: Array<{ field: string; message: string }> } {
  const error = new Error(message) as Error & {
    statusCode: number;
    errors?: Array<{ field: string; message: string }>;
  };
  error.statusCode = statusCode;
  if (errors) {
    error.errors = errors;
  }
  return error;
}

// Completion report length bounds (Req 17.4). The lower bound mirrors the
// existing service-layer check; the upper bound is enforced here in the
// controller/multipart layer.
const REPORT_MIN_LENGTH = 20;
const REPORT_MAX_LENGTH = 2000;

export async function assignTechnicianHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const { technicianId, serviceRequestId, scheduledDate, scheduledTime, priority } = req.body;
    const schedule = await scheduleService.assignTechnician({
      technicianId,
      serviceRequestId,
      scheduledDate,
      scheduledTime,
      priority,
    });

    res.status(201).json({ schedule });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/schedules/available-technicians?date=&slot=&excludeTechnicianId=
 *
 * Source for both the Assign dropdown (no exclusion) and the Reassign dropdown
 * (excludeTechnicianId = the schedule's current technician, Req 8.2). Delegates
 * to the shared Availability_Service (Req 7.1, 7.2, 7.3, 8.1, 8.2, 8.3) so the
 * dropdown reads the same availability rules the assign/reassign write paths
 * validate against.
 */
export async function getAvailableTechniciansHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const date = String(req.query.date ?? '').trim();
    const slot = String(req.query.slot ?? 'morning').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ message: 'A valid date (YYYY-MM-DD) is required' });
      return;
    }
    if (slot !== 'morning' && slot !== 'afternoon') {
      res.status(400).json({ message: 'Slot must be morning or afternoon' });
      return;
    }

    // Optional pre-filter: drop this technician before the availability checks
    // run (Req 7.7, 8.2). Absent/blank means "no exclusion" (Assign path).
    let excludeTechnicianId: number | undefined;
    if (req.query.excludeTechnicianId != null && String(req.query.excludeTechnicianId).trim() !== '') {
      const parsed = Number(req.query.excludeTechnicianId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        res.status(400).json({ message: 'excludeTechnicianId must be a positive integer' });
        return;
      }
      excludeTechnicianId = parsed;
    }

    const technicians = await availabilityService.getAvailableTechnicians({
      date,
      slot,
      excludeTechnicianId,
    });
    res.status(200).json({ technicians });
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/schedules/:id/reassign — admin reassigns to another technician. */
export async function reassignTechnicianHandler(
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
    const { technicianId } = req.body;
    // The acting admin is recorded on the reassignment audit row (Req 9.5).
    const schedule = await scheduleService.reassignTechnician(
      id,
      Number(technicianId),
      req.user.userId
    );

    res.status(200).json({ schedule, message: 'Task reassigned successfully' });
  } catch (error) {
    next(error);
  }
}

export async function listSchedulesHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;

    const result = await scheduleService.listSchedules({
      userId: req.user.userId,
      role: req.user.role,
      page,
      pageSize,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getScheduleByIdHandler(
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
    const schedule = await scheduleService.getScheduleById(
      id,
      req.user.userId,
      req.user.role
    );

    res.status(200).json({ schedule });
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/schedules/:id/start — assigned -> in-progress (technician or admin). */
export async function startTaskHandler(
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
    const schedule = await scheduleService.startTask(id, req.user.userId, req.user.role);

    res.status(200).json({ schedule, message: 'Task started (in-progress)' });
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/schedules/:id/undo — in-progress -> assigned (undo an accidental start). */
export async function undoTaskStatusHandler(
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
    const schedule = await scheduleService.undoTaskStatus(id, req.user.userId, req.user.role);

    res.status(200).json({ schedule, message: 'Task status reverted to assigned' });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/schedules/:id/complete — in-progress -> completed.
 * Multipart: report (text) + photo (file, required).
 *
 * This handler owns the multipart parse and the full validation order so the
 * responses are deterministic (Req 17.3, 17.4, 17.6, 17.7). The order is:
 *   1. missing field           → 400 naming the field
 *   2. report length 20–2000   → 400 naming `report`
 *   3. photo > 5 MB            → 413 payload-too-large
 *   4. photo type not allowed  → 415 unsupported-media-type
 * The photo is written to disk ONLY after all four checks pass, so a rejected
 * request never leaves a stray file behind (Req 17.1).
 */
export async function completeTaskHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    // Parse the multipart body. Multer errors (oversize / unsupported type) are
    // captured rather than thrown so they can be reported at the correct point
    // in the validation order below.
    const multipartError = await parseCompletionMultipart(req, res);

    const id = parseInt(req.params.id as string, 10);
    const report = typeof req.body.report === 'string' ? req.body.report : undefined;
    const file = req.file;

    // Was a photo part actually sent? A LIMIT_FILE_SIZE error means a photo WAS
    // sent but exceeded the cap, so it must not be treated as "missing".
    const isOversize =
      multipartError instanceof multer.MulterError &&
      multipartError.code === 'LIMIT_FILE_SIZE';
    const isUnsupportedType =
      !!multipartError &&
      (multipartError as { code?: string }).code === 'UNSUPPORTED_MEDIA_TYPE';
    const photoWasSent = !!file || isOversize || isUnsupportedType;

    // ── 1. Missing required field → 400 naming the field (Req 17.3) ──
    if (report == null || report.trim().length === 0) {
      throw httpError('Completion report is required', 400, [
        { field: 'report', message: 'Completion report is required' },
      ]);
    }
    if (!photoWasSent) {
      throw httpError('A completion photo is required', 400, [
        { field: 'photo', message: 'A completion photo is required' },
      ]);
    }

    // ── 2. Report length outside 20–2000 → 400 naming `report` (Req 17.4) ──
    const reportLength = report.trim().length;
    if (reportLength < REPORT_MIN_LENGTH || reportLength > REPORT_MAX_LENGTH) {
      throw httpError(
        `Completion report must be between ${REPORT_MIN_LENGTH} and ${REPORT_MAX_LENGTH} characters`,
        400,
        [
          {
            field: 'report',
            message: `Completion report must be between ${REPORT_MIN_LENGTH} and ${REPORT_MAX_LENGTH} characters`,
          },
        ]
      );
    }

    // ── 3. Photo larger than 5 MB → 413 (Req 17.6) ──
    if (isOversize) {
      throw httpError('Completion photo must not exceed 5 MB', 413, [
        { field: 'photo', message: 'Completion photo must not exceed 5 MB' },
      ]);
    }

    // ── 4. Photo type not JPEG/PNG/WEBP → 415 (Req 17.7) ──
    if (isUnsupportedType) {
      throw httpError(
        'Completion photo must be a JPEG, PNG, or WEBP image',
        415,
        [{ field: 'photo', message: 'Completion photo must be a JPEG, PNG, or WEBP image' }]
      );
    }

    // Any other multer/parse fault is unexpected — surface as 500.
    if (multipartError) {
      throw multipartError;
    }

    // A file must exist at this point (photoWasSent was true and no size/type
    // error fired), but guard defensively.
    if (!file) {
      throw httpError('A completion photo is required', 400, [
        { field: 'photo', message: 'A completion photo is required' },
      ]);
    }

    // ── All validation passed: persist the photo, then complete the task ──
    const photoPath = saveCompletionPhoto(file);

    const schedule = await scheduleService.completeTask(
      id,
      req.user.userId,
      req.user.role,
      report,
      photoPath
    );

    res.status(200).json({ schedule, message: 'Task completed successfully' });
  } catch (error) {
    next(error);
  }
}

// ── Admin archive (soft delete → Archive view) ──

/** GET /api/schedules/archived — admin only. Lists archived schedules. */
export async function listArchivedSchedulesHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }
    const data = await scheduleService.findArchivedSchedules();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/schedules/:id/archive — admin only. Archive (soft delete). */
export async function archiveScheduleHandler(
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
    await scheduleService.archiveSchedule(id);
    res.status(200).json({ message: 'Schedule moved to the archive' });
  } catch (error) {
    next(error);
  }
}

/** POST /api/schedules/:id/restore — admin only. Restore an archived schedule. */
export async function restoreScheduleHandler(
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
    await scheduleService.restoreSchedule(id);
    res.status(200).json({ message: 'Schedule restored' });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/schedules/:id/permanent — admin only. Permanently delete. */
export async function permanentlyDeleteScheduleHandler(
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
    await scheduleService.permanentlyDeleteSchedule(id);
    res.status(200).json({ message: 'Schedule permanently deleted' });
  } catch (error) {
    next(error);
  }
}
