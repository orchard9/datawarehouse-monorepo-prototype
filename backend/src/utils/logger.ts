/**
 * Structured logging system using Winston
 * Provides consistent logging across the application with proper formatting
 */

import winston from 'winston';
import { appConfig, isDevelopment } from '../config/index.js';
import { LoggerMeta } from '../types/index.js';

// Custom log format for development
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }

    // Add metadata if present
    const metaString = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return log + metaString;
  })
);

// Custom log format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  level: appConfig.logLevel,
  format: isDevelopment() ? developmentFormat : productionFormat,
  defaultMeta: {
    service: 'orchard9-datawarehouse-backend',
    version: '1.0.0',
    environment: appConfig.nodeEnv
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ],
  // Exit on uncaught exceptions
  exitOnError: false
});

// Add file transport for production
if (!isDevelopment()) {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

/**
 * Enhanced logger with additional utility methods
 */
class Logger {
  private winston: winston.Logger;

  constructor(winstonInstance: winston.Logger) {
    this.winston = winstonInstance;
  }

  /**
   * Log an error message
   */
  error(message: string, meta?: LoggerMeta): void {
    this.winston.error(message, meta);
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: LoggerMeta): void {
    this.winston.warn(message, meta);
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: LoggerMeta): void {
    this.winston.info(message, meta);
  }

  /**
   * Log an HTTP request/response
   */
  http(message: string, meta?: LoggerMeta): void {
    this.winston.http(message, meta);
  }

  /**
   * Log a verbose message
   */
  verbose(message: string, meta?: LoggerMeta): void {
    this.winston.verbose(message, meta);
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: LoggerMeta): void {
    this.winston.debug(message, meta);
  }

  /**
   * Log a silly message
   */
  silly(message: string, meta?: LoggerMeta): void {
    this.winston.silly(message, meta);
  }

  /**
   * Log an HTTP request
   */
  logRequest(method: string, url: string, statusCode: number, responseTime: number, meta?: Partial<LoggerMeta>): void {
    const level = statusCode >= 400 ? 'warn' : 'http';
    this.winston.log(level, `${method} ${url} ${statusCode} - ${responseTime}ms`, {
      method,
      url,
      statusCode,
      responseTime,
      ...meta
    });
  }

  /**
   * Log a database operation
   */
  logDatabase(operation: string, table: string, duration?: number, meta?: Partial<LoggerMeta>): void {
    this.winston.debug(`Database ${operation} on ${table}${duration ? ` (${duration}ms)` : ''}`, {
      operation,
      table,
      duration,
      ...meta
    });
  }

  /**
   * Log an API call to external service
   */
  logApiCall(service: string, endpoint: string, method: string, statusCode?: number, duration?: number, meta?: Partial<LoggerMeta>): void {
    const message = `API call to ${service} ${method} ${endpoint}${statusCode ? ` ${statusCode}` : ''}${duration ? ` (${duration}ms)` : ''}`;
    const level = statusCode && statusCode >= 400 ? 'warn' : 'info';

    this.winston.log(level, message, {
      service,
      endpoint,
      method,
      statusCode,
      duration,
      ...meta
    });
  }

  /**
   * Log an authentication event
   */
  logAuth(event: string, userId?: string, ip?: string, userAgent?: string, meta?: Partial<LoggerMeta>): void {
    this.winston.info(`Auth: ${event}`, {
      event,
      userId,
      ip,
      userAgent,
      ...meta
    });
  }

  /**
   * Log a security event
   */
  logSecurity(event: string, severity: 'low' | 'medium' | 'high' | 'critical', ip?: string, meta?: Partial<LoggerMeta>): void {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    this.winston.log(level, `Security: ${event}`, {
      event,
      severity,
      ip,
      ...meta
    });
  }

  /**
   * Log application performance metrics
   */
  logPerformance(metric: string, value: number, unit: string, meta?: Partial<LoggerMeta>): void {
    this.winston.info(`Performance: ${metric} = ${value}${unit}`, {
      metric,
      value,
      unit,
      ...meta
    });
  }

  /**
   * Create a child logger with additional default metadata
   */
  child(defaultMeta: LoggerMeta): Logger {
    const childLogger = this.winston.child(defaultMeta);
    return new Logger(childLogger);
  }
}

// Create and export the logger instance
const appLogger = new Logger(logger);

export default appLogger;
export { Logger };

// Export convenience methods
export const {
  error,
  warn,
  info,
  http,
  verbose,
  debug,
  silly,
  logRequest,
  logDatabase,
  logApiCall,
  logAuth,
  logSecurity,
  logPerformance
} = appLogger;