import { Request } from 'express';

export interface JwtPayload {
  userId: number;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
