/**
 * Security middleware for Express
 * Provides security headers, rate limiting, and CORS configuration
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { appConfig, isDevelopment } from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Configure CORS middleware
 */
export function configureCors() {
  const corsOptions: cors.CorsOptions = {
    origin: appConfig.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID'
    ],
    credentials: true,
    maxAge: 86400 // 24 hours
  };

  return cors(corsOptions);
}

/**
 * Configure Helmet for security headers
 */
export function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Allow for API usage
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });
}

/**
 * Configure rate limiting
 */
export function configureRateLimit() {
  return rateLimit({
    windowMs: appConfig.rateLimitWindowMs,
    max: appConfig.rateLimitMax,
    message: {
      success: false,
      error: 'Too many requests',
      message: `Too many requests from this IP, please try again after ${Math.ceil(appConfig.rateLimitWindowMs / 60000)} minutes.`,
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.logSecurity('Rate limit exceeded', 'medium', req.ip, {
        userAgent: req.get('User-Agent') || undefined,
        url: req.originalUrl,
        method: req.method
      });

      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: `Too many requests from this IP, please try again after ${Math.ceil(appConfig.rateLimitWindowMs / 60000)} minutes.`,
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log request
  logger.http(`${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || undefined,
    userAgent: req.get('User-Agent') || undefined,
    requestId: (req as any).id,
    contentLength: req.get('Content-Length') || undefined,
    referer: req.get('Referer') || undefined
  });

  // Log response when finished
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.logRequest(req.method, req.originalUrl, res.statusCode, responseTime, {
      requestId: (req as any).id,
      ip: req.ip || undefined,
      userAgent: req.get('User-Agent') || undefined,
      contentLength: res.get('Content-Length') || undefined
    });
  });

  next();
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Remove server information
  res.removeHeader('X-Powered-By');

  // Add custom security headers
  res.setHeader('X-Request-ID', (req as any).id || 'unknown');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add cache control for API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

/**
 * Input sanitization middleware
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize query parameters
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      req.query[key] = value.replace(/[<>]/g, '').trim();
    }
  }

  // Sanitize URL parameters
  for (const [key, value] of Object.entries(req.params)) {
    if (typeof value === 'string') {
      req.params[key] = value.replace(/[<>]/g, '').trim();
    }
  }

  next();
}

/**
 * API key validation middleware (if needed)
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.get('X-API-Key');

  // In development, skip API key validation
  if (isDevelopment()) {
    return next();
  }

  if (!apiKey) {
    logger.logSecurity('Missing API key', 'medium', req.ip, {
      userAgent: req.get('User-Agent') || undefined,
      url: req.originalUrl,
      method: req.method
    });

    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'API key required',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Validate API key (implement your logic here)
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (!validApiKeys.includes(apiKey)) {
    logger.logSecurity('Invalid API key', 'high', req.ip, {
      userAgent: req.get('User-Agent') || undefined,
      url: req.originalUrl,
      method: req.method,
      providedApiKey: apiKey.substring(0, 8) + '...' // Log partial key for debugging
    });

    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid API key',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
}

/**
 * IP whitelist middleware (if needed)
 */
export function ipWhitelist(allowedIPs: string[] = []) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowedIPs.length === 0 || isDevelopment()) {
      return next();
    }

    const clientIP = req.ip || '';

    if (!allowedIPs.includes(clientIP)) {
      logger.logSecurity('IP not whitelisted', 'high', clientIP, {
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        method: req.method
      });

      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied from this IP address',
        timestamp: new Date().toISOString()
      });
      return;
    }

    next();
  };
}

/**
 * Request size limit middleware
 */
export function requestSizeLimit(maxSize: string = '10mb') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');

    if (contentLength) {
      const sizeMB = parseInt(contentLength) / (1024 * 1024);
      const maxSizeMB = parseInt(maxSize.replace('mb', ''));

      if (sizeMB > maxSizeMB) {
        logger.logSecurity('Request size too large', 'medium', req.ip, {
          contentLength,
          maxSize,
          url: req.originalUrl,
          method: req.method
        });

        res.status(413).json({
          success: false,
          error: 'Payload too large',
          message: `Request size exceeds ${maxSize} limit`,
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    next();
  };
}

export default {
  configureCors,
  configureHelmet,
  configureRateLimit,
  requestLogger,
  securityHeaders,
  sanitizeInput,
  validateApiKey,
  ipWhitelist,
  requestSizeLimit
};