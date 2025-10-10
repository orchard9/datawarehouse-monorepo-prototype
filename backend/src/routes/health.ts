/**
 * Health check routes
 * Provides endpoints for monitoring application health and status
 */

import { Router, Request, Response } from 'express';
import { getDatabase } from '../database/connection.js';
import { appConfig } from '../config/index.js';
import logger from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { HealthCheckResult } from '../types/index.js';

const router = Router();

/**
 * Basic health check endpoint
 * GET /health
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  logger.debug('Health check requested');

  const healthData: HealthCheckResult = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Orchard9 Data Warehouse Backend',
    version: '1.0.0',
    database: {
      connected: false,
      path: appConfig.databasePath
    },
    memory: {
      used: 0,
      total: 0,
      percentage: 0
    },
    environment: appConfig.nodeEnv
  };

  try {
    // Check database connection
    const db = getDatabase();
    const dbHealth = await db.healthCheck();

    healthData.database = {
      connected: dbHealth.connected,
      path: dbHealth.path,
      size: dbHealth.size || 0
    };

    // Get memory usage
    const memUsage = process.memoryUsage();
    healthData.memory = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 10000) / 100 // Percentage
    };

    // Log successful health check
    logger.info('Health check completed successfully', {
      uptime: healthData.uptime,
      databaseConnected: healthData.database.connected,
      memoryUsage: healthData.memory.percentage
    });

    res.health(healthData);

  } catch (error) {
    // If any check fails, return error status
    healthData.status = 'ERROR';

    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(503).json({
      success: false,
      data: healthData,
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
      requestId: (req as any).id
    });
  }
}));

/**
 * Detailed health check endpoint
 * GET /health/detailed
 */
router.get('/detailed', asyncHandler(async (_req: Request, res: Response) => {
  logger.debug('Detailed health check requested');

  const startTime = Date.now();

  try {
    // Get basic health data
    const db = getDatabase();
    const dbHealth = await db.healthCheck();
    const memUsage = process.memoryUsage();

    const detailedHealth = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: process.uptime(),
        formatted: formatUptime(process.uptime())
      },
      service: {
        name: 'Orchard9 Data Warehouse Backend',
        version: '1.0.0',
        environment: appConfig.nodeEnv,
        port: appConfig.port,
        nodeVersion: process.version
      },
      database: {
        connected: dbHealth.connected,
        path: dbHealth.path,
        size: dbHealth.size ? {
          bytes: dbHealth.size,
          formatted: formatBytes(dbHealth.size)
        } : null,
        tables: dbHealth.tables,
        tableCount: dbHealth.tables.length,
        readonly: dbHealth.readonly
      },
      memory: {
        heapUsed: {
          bytes: memUsage.heapUsed,
          formatted: formatBytes(memUsage.heapUsed)
        },
        heapTotal: {
          bytes: memUsage.heapTotal,
          formatted: formatBytes(memUsage.heapTotal)
        },
        external: {
          bytes: memUsage.external,
          formatted: formatBytes(memUsage.external)
        },
        rss: {
          bytes: memUsage.rss,
          formatted: formatBytes(memUsage.rss)
        },
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 10000) / 100
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        cwd: process.cwd()
      },
      configuration: {
        logLevel: appConfig.logLevel,
        rateLimitWindowMs: appConfig.rateLimitWindowMs,
        rateLimitMax: appConfig.rateLimitMax
      },
      performance: {
        responseTime: Date.now() - startTime
      }
    };

    logger.info('Detailed health check completed', {
      responseTime: detailedHealth.performance.responseTime,
      memoryUsage: detailedHealth.memory.percentage,
      databaseConnected: detailedHealth.database.connected,
      tableCount: detailedHealth.database.tableCount
    });

    res.success(detailedHealth, 'Detailed health check completed successfully');

  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error instanceof Error ? error.message : String(error),
      responseTime: Date.now() - startTime
    });

    res.status(503).error(
      'Detailed health check failed',
      503,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}));

/**
 * Database health check endpoint
 * GET /health/database
 */
router.get('/database', asyncHandler(async (_req: Request, res: Response) => {
  logger.debug('Database health check requested');

  try {
    const db = getDatabase();
    const dbHealth = await db.healthCheck();

    const databaseStatus = {
      status: dbHealth.connected ? 'OK' : 'ERROR',
      timestamp: new Date().toISOString(),
      connection: {
        connected: dbHealth.connected,
        path: dbHealth.path,
        readonly: dbHealth.readonly
      },
      file: {
        exists: dbHealth.size !== null,
        size: dbHealth.size ? {
          bytes: dbHealth.size,
          formatted: formatBytes(dbHealth.size)
        } : null
      },
      schema: {
        tables: dbHealth.tables,
        tableCount: dbHealth.tables.length
      }
    };

    if (dbHealth.connected) {
      // Get additional database info
      const schemaInfo = db.getSchemaInfo();
      (databaseStatus as any).schemaDetails = schemaInfo;

      logger.info('Database health check successful', {
        tableCount: dbHealth.tables.length,
        databaseSize: dbHealth.size
      });

      res.success(databaseStatus, 'Database is healthy');
    } else {
      logger.warn('Database health check failed - not connected');
      res.status(503).error('Database is not connected', 503, databaseStatus);
    }

  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(503).error(
      'Database health check failed',
      503,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}));

/**
 * Ready/liveness probe endpoint
 * GET /health/ready
 */
router.get('/ready', asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Check if the application is ready to serve requests
    const db = getDatabase();
    const isReady = db.isConnected();

    if (isReady) {
      res.success({ ready: true }, 'Application is ready');
    } else {
      res.status(503).error('Application is not ready');
    }

  } catch (error) {
    logger.error('Readiness check failed', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(503).error('Application is not ready');
  }
}));

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}

/**
 * Format bytes in human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default router;