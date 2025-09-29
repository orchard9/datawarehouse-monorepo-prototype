/**
 * HTTP response utilities for consistent API responses
 * Provides standardized response formatting across the application
 */

import { Response } from 'express';
import { ApiResponse, PaginatedResponse, PaginationMeta } from '../types/index.js';

/**
 * Generate request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create standardized API response
 */
function createApiResponse<T>(
  success: boolean,
  data?: T,
  message?: string,
  error?: string,
  requestId?: string
): ApiResponse<T> {
  return {
    success,
    ...(data !== undefined && { data }),
    ...(message && { message }),
    ...(error && { error }),
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId })
  };
}

/**
 * Create paginated API response
 */
function createPaginatedResponse<T>(
  data: T[],
  meta: PaginationMeta,
  message?: string,
  requestId?: string
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    meta,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId })
  };
}

/**
 * Response utility class
 */
export class ResponseUtils {
  /**
   * Send successful response with data
   */
  static success<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = 200,
    requestId?: string
  ): Response {
    const response = createApiResponse(true, data, message, undefined, requestId);
    return res.status(statusCode).json(response);
  }

  /**
   * Send successful response without data
   */
  static successMessage(
    res: Response,
    message: string,
    statusCode: number = 200,
    requestId?: string
  ): Response {
    const response = createApiResponse(true, undefined, message, undefined, requestId);
    return res.status(statusCode).json(response);
  }

  /**
   * Send paginated response
   */
  static paginated<T>(
    res: Response,
    data: T[],
    meta: PaginationMeta,
    message?: string,
    statusCode: number = 200,
    requestId?: string
  ): Response {
    const response = createPaginatedResponse(data, meta, message, requestId);
    return res.status(statusCode).json(response);
  }

  /**
   * Send created response (201)
   */
  static created<T>(
    res: Response,
    data: T,
    message?: string,
    requestId?: string
  ): Response {
    return this.success(res, data, message || 'Resource created successfully', 201, requestId);
  }

  /**
   * Send no content response (204)
   */
  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    error: string,
    statusCode: number = 500,
    details?: any,
    requestId?: string
  ): Response {
    const response = createApiResponse(false, undefined, undefined, error, requestId);
    if (details) {
      (response as any).details = details;
    }
    return res.status(statusCode).json(response);
  }

  /**
   * Send bad request response (400)
   */
  static badRequest(
    res: Response,
    error: string = 'Bad Request',
    details?: any,
    requestId?: string
  ): Response {
    return this.error(res, error, 400, details, requestId);
  }

  /**
   * Send unauthorized response (401)
   */
  static unauthorized(
    res: Response,
    error: string = 'Unauthorized',
    requestId?: string
  ): Response {
    return this.error(res, error, 401, undefined, requestId);
  }

  /**
   * Send forbidden response (403)
   */
  static forbidden(
    res: Response,
    error: string = 'Forbidden',
    requestId?: string
  ): Response {
    return this.error(res, error, 403, undefined, requestId);
  }

  /**
   * Send not found response (404)
   */
  static notFound(
    res: Response,
    error: string = 'Resource not found',
    requestId?: string
  ): Response {
    return this.error(res, error, 404, undefined, requestId);
  }

  /**
   * Send validation error response (422)
   */
  static validationError(
    res: Response,
    error: string = 'Validation failed',
    validationErrors?: any[],
    requestId?: string
  ): Response {
    return this.error(res, error, 422, { validationErrors }, requestId);
  }

  /**
   * Send too many requests response (429)
   */
  static tooManyRequests(
    res: Response,
    error: string = 'Too many requests',
    requestId?: string
  ): Response {
    return this.error(res, error, 429, undefined, requestId);
  }

  /**
   * Send internal server error response (500)
   */
  static internalError(
    res: Response,
    error: string = 'Internal server error',
    requestId?: string
  ): Response {
    return this.error(res, error, 500, undefined, requestId);
  }

  /**
   * Send health check response
   */
  static health(res: Response, data: any, requestId?: string): Response {
    return this.success(res, data, 'Health check successful', 200, requestId);
  }
}

/**
 * Express middleware to add response utilities to response object
 */
export function addResponseUtils(req: any, res: Response, next: any): void {
  // Add request ID to request object
  req.id = generateRequestId();

  // Add response utilities as methods
  res.success = <T>(data: T, message?: string, statusCode?: number) =>
    ResponseUtils.success(res, data, message, statusCode, req.id);

  res.successMessage = (message: string, statusCode?: number) =>
    ResponseUtils.successMessage(res, message, statusCode, req.id);

  res.paginated = <T>(data: T[], meta: PaginationMeta, message?: string, statusCode?: number) =>
    ResponseUtils.paginated(res, data, meta, message, statusCode, req.id);

  res.created = <T>(data: T, message?: string) =>
    ResponseUtils.created(res, data, message, req.id);

  res.noContent = () =>
    ResponseUtils.noContent(res);

  res.error = (error: string, statusCode?: number, details?: any) =>
    ResponseUtils.error(res, error, statusCode, details, req.id);

  res.badRequest = (error?: string, details?: any) =>
    ResponseUtils.badRequest(res, error, details, req.id);

  res.unauthorized = (error?: string) =>
    ResponseUtils.unauthorized(res, error, req.id);

  res.forbidden = (error?: string) =>
    ResponseUtils.forbidden(res, error, req.id);

  res.notFound = (error?: string) =>
    ResponseUtils.notFound(res, error, req.id);

  res.validationError = (error?: string, validationErrors?: any[]) =>
    ResponseUtils.validationError(res, error, validationErrors, req.id);

  res.tooManyRequests = (error?: string) =>
    ResponseUtils.tooManyRequests(res, error, req.id);

  res.internalError = (error?: string) =>
    ResponseUtils.internalError(res, error, req.id);

  res.health = (data: any) =>
    ResponseUtils.health(res, data, req.id);

  next();
}

// Extend Express Response interface
declare global {
  namespace Express {
    interface Response {
      success: <T>(data: T, message?: string, statusCode?: number) => Response;
      successMessage: (message: string, statusCode?: number) => Response;
      paginated: <T>(data: T[], meta: PaginationMeta, message?: string, statusCode?: number) => Response;
      created: <T>(data: T, message?: string) => Response;
      noContent: () => Response;
      error: (error: string, statusCode?: number, details?: any) => Response;
      badRequest: (error?: string, details?: any) => Response;
      unauthorized: (error?: string) => Response;
      forbidden: (error?: string) => Response;
      notFound: (error?: string) => Response;
      validationError: (error?: string, validationErrors?: any[]) => Response;
      tooManyRequests: (error?: string) => Response;
      internalError: (error?: string) => Response;
      health: (data: any) => Response;
    }
  }
}

export { generateRequestId, createApiResponse, createPaginatedResponse };
export default ResponseUtils;