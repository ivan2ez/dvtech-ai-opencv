import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import * as serviceRequestService from '../services/serviceRequestService';

export async function createServiceRequestHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Access denied. No token provided.' });
      return;
    }

    const { serviceType, acDetails } = req.body;
    const serviceRequest = await serviceRequestService.createServiceRequest(
      { serviceType, acDetails },
      req.user.userId
    );

    res.status(201).json({ serviceRequest });
  } catch (error) {
    next(error);
  }
}

export async function listServiceRequestsHandler(
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

    const result = await serviceRequestService.listServiceRequests({
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

export async function getServiceRequestByIdHandler(
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
    const serviceRequest = await serviceRequestService.getServiceRequestById(
      id,
      req.user.userId,
      req.user.role
    );

    res.status(200).json({ serviceRequest });
  } catch (error) {
    next(error);
  }
}

export async function approveServiceRequestHandler(
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
    const serviceRequest = await serviceRequestService.approveServiceRequest(
      id,
      req.user.role
    );

    res.status(200).json({ serviceRequest, message: 'Service request approved successfully' });
  } catch (error) {
    next(error);
  }
}

export async function rejectServiceRequestHandler(
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
    const serviceRequest = await serviceRequestService.rejectServiceRequest(
      id,
      req.user.role,
      reason
    );

    res.status(200).json({ serviceRequest, message: 'Service request rejected successfully' });
  } catch (error) {
    next(error);
  }
}
