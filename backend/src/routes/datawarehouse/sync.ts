/**
 * Data Warehouse Sync & Health Routes
 * API endpoints for sync status monitoring and health checks
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ErrorUtils } from '../../utils/errors.js';
import { DataWarehouseSyncService } from '../../services/dataWarehouseService.js';
import { SyncStatusQuery } from '../../types/index.js';
import logger from '../../utils/logger.js';

const router = Router();

// Validation schemas
const SyncStatusQuerySchema = z.object({
  syncType: z.enum(['campaigns', 'metrics', 'reports', 'full']).optional(),
  status: z.enum(['running', 'completed', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeCurrent: z.coerce.boolean().optional()
});

// Validation middleware
const validateSyncStatusQuery = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedQuery = SyncStatusQuerySchema.parse(req.query);
    req.query = validatedQuery as any;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        value: (err as any).input ?? 'unknown'
      }));

      res.error('Validation failed', 400, {
        code: 'VALIDATION_ERROR',
        errors: validationErrors
      });
      return;
    }
    next(error);
  }
};

/**
 * GET /api/datawarehouse/sync/status
 * Get current sync status and recent history
 */
router.get('/status', validateSyncStatusQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const query = req.query as SyncStatusQuery;

  logger.info('Fetching sync status', {
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const syncStatus = await DataWarehouseSyncService.getSyncStatus(query);

  res.success({
    ...syncStatus,
    _metadata: {
      isRunning: syncStatus.current.isRunning,
      recentSyncsCount: syncStatus.recent.length,
      successRate: Math.round(syncStatus.summary.successRate * 100) / 100
    }
  }, 'Sync status retrieved successfully', 200);
}));

/**
 * GET /api/datawarehouse/sync/history
 * Get detailed sync operation history
 */
router.get('/history', validateSyncStatusQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const query = req.query as SyncStatusQuery;

  logger.info('Fetching sync history', {
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const syncHistory = await DataWarehouseSyncService.getSyncHistory(query);

  if (syncHistory.data) {
    res.paginated(syncHistory.data, syncHistory.meta, 'Sync history retrieved successfully');
  } else {
    res.error('Failed to retrieve sync history', 500, { code: 'SERVICE_ERROR' });
  }
}));

/**
 * GET /api/datawarehouse/health
 * Comprehensive health check for data warehouse
 */
router.get('/health', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  logger.info('Performing data warehouse health check', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const healthCheck = await DataWarehouseSyncService.getHealthCheck();

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';

  if (!healthCheck.database.connected) {
    overallStatus = 'down';
  } else if (
    healthCheck.api.status === 'degraded' ||
    healthCheck.database.dataFreshness.isStale ||
    healthCheck.dataQuality.dataCompleteness < 80
  ) {
    overallStatus = 'degraded';
  }

  const statusCode = overallStatus === 'down' ? 503 : 200;

  res.status(statusCode).json({
    success: overallStatus !== 'down',
    data: {
      ...healthCheck,
      overallStatus,
      timestamp: new Date().toISOString()
    },
    message: `Data warehouse health check completed - ${overallStatus}`,
    timestamp: new Date().toISOString()
  });

  logger.info('Health check completed', {
    overallStatus,
    dbConnected: healthCheck.database.connected,
    dataFreshness: healthCheck.database.dataFreshness.hoursSinceLastSync,
    dataCompleteness: Math.round(healthCheck.dataQuality.dataCompleteness * 100) / 100,
    responseTime: healthCheck.api.responseTime
  });
}));

/**
 * GET /api/datawarehouse/health/database
 * Database-specific health check
 */
router.get('/health/database', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  logger.info('Performing database health check', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const healthCheck = await DataWarehouseSyncService.getHealthCheck();
  const dbHealth = healthCheck.database;

  const statusCode = dbHealth.connected ? 200 : 503;

  res.status(statusCode).json({
    success: dbHealth.connected,
    data: {
      database: dbHealth,
      timestamp: new Date().toISOString()
    },
    message: `Database health check completed - ${dbHealth.connected ? 'connected' : 'disconnected'}`,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/datawarehouse/health/data-quality
 * Data quality metrics and validation
 */
router.get('/health/data-quality', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  logger.info('Performing data quality check', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const healthCheck = await DataWarehouseSyncService.getHealthCheck();
  const dataQuality = healthCheck.dataQuality;

  // Determine data quality status
  let qualityStatus: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';

  if (dataQuality.dataCompleteness < 50) {
    qualityStatus = 'poor';
  } else if (dataQuality.dataCompleteness < 70) {
    qualityStatus = 'fair';
  } else if (dataQuality.dataCompleteness < 90) {
    qualityStatus = 'good';
  }

  res.success({
    ...dataQuality,
    qualityStatus,
    recommendations: generateDataQualityRecommendations(dataQuality),
    timestamp: new Date().toISOString()
  }, `Data quality check completed - ${qualityStatus}`);
}));

/**
 * POST /api/datawarehouse/sync/trigger
 * Trigger a data synchronization from Peach AI APIs
 */
router.post('/trigger', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  logger.info('Triggering data sync', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const { spawn } = await import('child_process');
  const path = await import('path');

  // Path to Python script
  const pythonScript = path.join(process.cwd(), '..', 'datawarehouse-job', 'main.py');

  // Trigger sync asynchronously
  const syncProcess = spawn('python', [pythonScript, 'sync'], {
    cwd: path.join(process.cwd(), '..', 'datawarehouse-job'),
    detached: false
  });

  let output = '';
  let errorOutput = '';

  syncProcess.stdout.on('data', (data) => {
    output += data.toString();
    logger.info('Sync output:', { data: data.toString() });
  });

  syncProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
    logger.error('Sync error:', { error: data.toString() });
  });

  syncProcess.on('close', (code) => {
    if (code === 0) {
      logger.info('Sync completed successfully');
    } else {
      logger.error('Sync failed', { exitCode: code, error: errorOutput });
    }
  });

  // Return immediately with accepted status
  res.status(202).json({
    success: true,
    data: {
      status: 'accepted',
      message: 'Data sync has been triggered and is running in the background',
      timestamp: new Date().toISOString()
    },
    message: 'Sync triggered successfully',
    timestamp: new Date().toISOString()
  });
}));

/**
 * Generate data quality recommendations based on metrics
 */
function generateDataQualityRecommendations(dataQuality: any): string[] {
  const recommendations: string[] = [];

  if (dataQuality.dataCompleteness < 80) {
    recommendations.push('Consider running a full data sync to improve data completeness');
  }

  if (dataQuality.hierarchyMappingCoverage < 70) {
    recommendations.push('Review and update hierarchy mapping rules to improve campaign categorization');
  }

  if (dataQuality.campaignsWithoutData > dataQuality.campaignsWithData) {
    recommendations.push('Many campaigns have no associated metrics data - verify ETL pipeline is capturing all campaigns');
  }

  if (dataQuality.recentDataPoints === 0) {
    recommendations.push('No recent data points found - check if data sync is running regularly');
  }

  const daysSinceOldest = dataQuality.oldestDataPoint
    ? Math.floor((Date.now() - new Date(dataQuality.oldestDataPoint).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  if (daysSinceOldest > 90) {
    recommendations.push('Consider archiving very old data to improve query performance');
  }

  if (recommendations.length === 0) {
    recommendations.push('Data quality looks good - no immediate actions required');
  }

  return recommendations;
}

export default router;