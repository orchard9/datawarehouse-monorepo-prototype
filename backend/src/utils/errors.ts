/**
 * Custom error classes and error handling utilities
 * Provides structured error handling for the application
 */

import { AppError, ValidationError } from '../types/index.js';

/**
 * Base application error class
 */
export class BaseError extends Error implements AppError {
  public readonly statusCode: number;
  public readonly code?: string | undefined;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends BaseError {
  constructor(message: string = 'Bad Request', code?: string, details?: any) {
    super(message, 400, code, details);
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends BaseError {
  constructor(message: string = 'Unauthorized', code?: string, details?: any) {
    super(message, 401, code, details);
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends BaseError {
  constructor(message: string = 'Forbidden', code?: string, details?: any) {
    super(message, 403, code, details);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends BaseError {
  constructor(message: string = 'Resource not found', code?: string, details?: any) {
    super(message, 404, code, details);
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends BaseError {
  constructor(message: string = 'Resource conflict', code?: string, details?: any) {
    super(message, 409, code, details);
  }
}

/**
 * Validation Error (422)
 */
export class RequestValidationError extends BaseError {
  public readonly validationErrors: ValidationError[];

  constructor(
    message: string = 'Validation failed',
    validationErrors: ValidationError[] = [],
    code: string = 'VALIDATION_ERROR'
  ) {
    super(message, 422, code, { validationErrors });
    this.validationErrors = validationErrors;
  }

  /**
   * Create validation error from Joi error
   */
  static fromJoiError(joiError: any): RequestValidationError {
    const validationErrors: ValidationError[] = joiError.details?.map((detail: any) => ({
      field: detail.path?.join('.') || 'unknown',
      message: detail.message,
      value: detail.context?.value
    })) || [];

    return new RequestValidationError('Request validation failed', validationErrors);
  }

  /**
   * Create validation error from Zod error
   */
  static fromZodError(zodError: any): RequestValidationError {
    const validationErrors: ValidationError[] = zodError.errors?.map((error: any) => ({
      field: error.path?.join('.') || 'unknown',
      message: error.message,
      value: error.received
    })) || [];

    return new RequestValidationError('Request validation failed', validationErrors);
  }
}

/**
 * Too Many Requests Error (429)
 */
export class TooManyRequestsError extends BaseError {
  constructor(message: string = 'Too many requests', code?: string, details?: any) {
    super(message, 429, code, details);
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends BaseError {
  constructor(message: string = 'Internal server error', code?: string, details?: any) {
    super(message, 500, code, details);
  }
}

/**
 * Database Error
 */
export class DatabaseError extends BaseError {
  constructor(message: string = 'Database operation failed', code?: string, details?: any) {
    super(message, 500, code || 'DATABASE_ERROR', details);
  }
}

/**
 * External API Error
 */
export class ExternalApiError extends BaseError {
  constructor(
    message: string = 'External API error',
    statusCode: number = 500,
    code?: string,
    details?: any
  ) {
    super(message, statusCode, code || 'EXTERNAL_API_ERROR', details);
  }
}

/**
 * Configuration Error
 */
export class ConfigurationError extends BaseError {
  constructor(message: string = 'Configuration error', code?: string, details?: any) {
    super(message, 500, code || 'CONFIGURATION_ERROR', details, false);
  }
}

/**
 * Check if error is operational
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Create error response object
 */
export function createErrorResponse(error: Error, requestId?: string) {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  if (error instanceof BaseError) {
    statusCode = error.statusCode;
    code = error.code || 'UNKNOWN_ERROR';
    message = error.message;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error.name === 'SyntaxError') {
    statusCode = 400;
    code = 'SYNTAX_ERROR';
    message = 'Invalid JSON syntax';
  }

  const response: any = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details })
    },
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId })
  };

  return { statusCode, response };
}

/**
 * Error handler utility functions
 */
export const ErrorUtils = {
  /**
   * Wrap async function to catch errors
   */
  catchAsync: (fn: Function) => {
    return (req: any, res: any, next: any) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  },

  /**
   * Assert condition or throw error
   */
  assert: (condition: any, error: BaseError): void => {
    if (!condition) {
      throw error;
    }
  },

  /**
   * Throw NotFoundError if resource is null/undefined
   */
  assertFound: (resource: any, message?: string): void => {
    if (resource === null || resource === undefined) {
      throw new NotFoundError(message);
    }
  },

  /**
   * Validate and throw BadRequestError if invalid
   */
  validateRequest: (isValid: boolean, message?: string, details?: any): void => {
    if (!isValid) {
      throw new BadRequestError(message, 'INVALID_REQUEST', details);
    }
  },

  /**
   * Handle database errors consistently
   */
  handleDatabaseError: (error: any, operation: string): never => {
    const message = `Database ${operation} failed: ${error.message || 'Unknown error'}`;
    throw new DatabaseError(message, 'DATABASE_OPERATION_FAILED', {
      operation,
      originalError: error.message
    });
  }
};

export default {
  BaseError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RequestValidationError,
  TooManyRequestsError,
  InternalServerError,
  DatabaseError,
  ExternalApiError,
  ConfigurationError,
  isOperationalError,
  createErrorResponse,
  ErrorUtils
};