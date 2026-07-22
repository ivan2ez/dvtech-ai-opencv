/**
 * Mock Express Request, Response, and NextFunction utilities.
 *
 * Provides factory functions to create mock request/response objects
 * for testing Express controllers and middleware without a running server.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, JwtPayload } from '../../types';

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
  sendStatus: jest.Mock;
  set: jest.Mock;
  header: jest.Mock;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  redirect: jest.Mock;
  download: jest.Mock;
  end: jest.Mock;
  locals: Record<string, any>;
  headersSent: boolean;
  statusCode: number;
};

type MockRequest = Partial<AuthenticatedRequest> & {
  body: Record<string, any>;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  user?: JwtPayload;
  file?: any;
  files?: any;
};

interface MockRequestOptions {
  body?: Record<string, any>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  user?: JwtPayload;
  file?: any;
  files?: any;
}

/**
 * Creates a mock Express Response object with chainable methods.
 * All methods (status, json, send, etc.) are jest.fn() instances.
 *
 * @returns A mock Response object with all common methods mocked
 */
export function createMockResponse(): MockResponse {
  const res: MockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    sendStatus: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    download: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    locals: {},
    headersSent: false,
    statusCode: 200,
  };

  // Track status code when status() is called
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });

  return res;
}

/**
 * Creates a mock Express Request object with configurable properties.
 *
 * @param options - Optional configuration for body, params, query, headers, user, file
 * @returns A mock AuthenticatedRequest object
 */
export function createMockRequest(options: MockRequestOptions = {}): MockRequest {
  const req: MockRequest = {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    headers: options.headers || {},
    user: options.user,
    file: options.file,
    files: options.files,
  };

  return req;
}

/**
 * Creates a mock Express NextFunction.
 *
 * @returns A jest.fn() that acts as the Express next() function
 */
export function createMockNext(): jest.MockedFunction<NextFunction> {
  return jest.fn() as jest.MockedFunction<NextFunction>;
}

/**
 * Convenience function to create all three mock objects at once.
 * Useful for controller test setup.
 *
 * @param requestOptions - Optional configuration for the mock request
 * @returns Object containing req, res, and next mocks
 */
export function createMockExpressContext(requestOptions: MockRequestOptions = {}) {
  return {
    req: createMockRequest(requestOptions),
    res: createMockResponse(),
    next: createMockNext(),
  };
}
