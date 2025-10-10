/**
 * Error handling middleware for Express
 * Provides centralized error handling with proper logging and response formatting
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import { createErrorResponse, isOperationalError, BaseError } from '../utils/errors.js';
import { isDevelopment } from '../config/index.js';

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to error handling middleware
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found middleware for unmatched routes
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const error = new BaseError(
    `Route ${req.method} ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
}

/**
 * Global error handling middleware
 * Must be the last middleware in the chain
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  const errorId = (req as any).id || 'unknown';
  const logMeta = {
    requestId: errorId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || undefined,
    userAgent: req.get('User-Agent') || undefined,
    body: req.body,
    query: req.query,
    params: req.params
  };

  // Determine log level based on error type
  if (error instanceof BaseError && error.statusCode < 500) {
    // Client errors (4xx) - log as warning
    logger.warn(`Client error: ${error.message}`, {
      ...logMeta,
      statusCode: error.statusCode,
      code: error.code,
      stack: isDevelopment() ? error.stack : undefined
    });
  } else {
    // Server errors (5xx) or unknown errors - log as error
    logger.error(`Server error: ${error.message}`, {
      ...logMeta,
      stack: error.stack,
      isOperational: isOperationalError(error)
    });
  }

  // Don't expose error details in production for non-operational errors
  let errorToSend = error;
  if (!isDevelopment() && !isOperationalError(error)) {
    errorToSend = new BaseError('An unexpected error occurred', 500, 'INTERNAL_SERVER_ERROR');
  }

  // Create error response
  const { statusCode, response } = createErrorResponse(errorToSend, errorId);

  // Add stack trace in development mode
  if (isDevelopment() && error.stack) {
    (response as any).stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(response);
}

/**
 * Unhandled rejection handler
 */
export function handleUnhandledRejection(): void {
  process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString()
    });

    // In production, you might want to gracefully shutdown
    if (!isDevelopment()) {
      logger.error('Shutting down due to unhandled promise rejection');
      process.exit(1);
    }
  });
}

/**
 * Uncaught exception handler
 */
export function handleUncaughtException(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Always exit on uncaught exceptions
    logger.error('Shutting down due to uncaught exception');
    process.exit(1);
  });
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown(server: any): void {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);

    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          requestId: (req as any).id,
          method: req.method,
          url: req.originalUrl,
          timeout: timeoutMs
        });

        res.status(408).json({
          success: false,
          error: 'Request timeout',
          message: `Request timed out after ${timeoutMs}ms`,
          timestamp: new Date().toISOString(),
          requestId: (req as any).id
        });
      }
    }, timeoutMs);

    // Clear timeout when response is finished
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

export default {
  asyncHandler,
  notFoundHandler,
  errorHandler,
  handleUnhandledRejection,
  handleUncaughtException,
  setupGracefulShutdown,
  requestTimeout
};