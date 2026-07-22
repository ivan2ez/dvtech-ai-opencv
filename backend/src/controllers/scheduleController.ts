import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import * as scheduleService from '../services/scheduleService';

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

    const { technicianId, serviceRequestId, scheduledDate, priority } = req.body;
    const schedule = await scheduleService.assignTechnician({
      technicianId,
      serviceRequestId,
      scheduledDate,
      priority,
    });

    res.status(201).json({ schedule });
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

export async function acceptTaskHandler(
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
    const schedule = await scheduleService.acceptTask(id, req.user.userId);

    res.status(200).json({ schedule, message: 'Task accepted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function rejectTaskHandler(
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
    const { reason } = req.body;
    const schedule = await scheduleService.rejectTask(id, req.user.userId, reason);

    res.status(200).json({ schedule, message: 'Task rejected successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateTaskStatusHandler(
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
    const schedule = await scheduleService.updateTaskStatus(id, req.user.userId);

    res.status(200).json({ schedule, message: 'Task status updated to in-progress' });
  } catch (error) {
    next(error);
  }
}

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

    const id = parseInt(req.params.id as string, 10);
    const { report } = req.body;
    const schedule = await scheduleService.completeTask(id, req.user.userId, report);

    res.status(200).json({ schedule, message: 'Task completed successfully' });
  } catch (error) {
    next(error);
  }
}
