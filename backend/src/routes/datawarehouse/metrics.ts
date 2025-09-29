/**
 * Data Warehouse Metrics Routes
 * API endpoints for metrics aggregation and analytics
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ErrorUtils } from '../../utils/errors.js';
import { DataWarehouseMetricsService } from '../../services/dataWarehouseService.js';
import { DataWarehouseMetricsQuery } from '../../types/index.js';
import logger from '../../utils/logger.js';

const router = Router();

// Validation schemas
const MetricsQuerySchema = z.object({
  campaignId: z.coerce.number().int().min(1).optional(),
  campaignIds: z.string().transform((val) => {
    if (!val) return undefined;
    return val.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0);
  }).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).optional(),
  aggregateBy: z.enum(['sum', 'avg', 'min', 'max']).optional(),
  hourStart: z.coerce.number().int().min(0).max(23).optional(),
  hourEnd: z.coerce.number().int().min(0).max(23).optional(),
  includeTotals: z.coerce.boolean().optional(),
  includeCalculatedFields: z.coerce.boolean().optional()
});

const PerformanceQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional()
});

// Validation middleware
const validateMetricsQuery = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedQuery = MetricsQuerySchema.parse(req.query);
    (req as any).validatedQuery = validatedQuery;
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

const validatePerformanceQuery = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedQuery = PerformanceQuerySchema.parse(req.query);
    (req as any).validatedQuery = validatedQuery;
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
 * GET /api/datawarehouse/metrics/hourly
 * Get hourly metrics data with optional aggregation
 */
router.get('/hourly', validateMetricsQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const query = (req as any).validatedQuery as DataWarehouseMetricsQuery;

  logger.info('Fetching hourly metrics', {
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const metrics = await DataWarehouseMetricsService.getHourlyMetrics(query);

  res.success({
    data: metrics,
    _metadata: {
      count: metrics.length,
      groupBy: query.groupBy || 'hour',
      dateRange: `${query.startDate || 'beginning'} to ${query.endDate || 'latest'}`
    }
  }, 'Hourly metrics retrieved successfully', 200);
}));

/**
 * GET /api/datawarehouse/metrics/aggregated
 * Get aggregated metrics across campaigns
 */
router.get('/aggregated', validateMetricsQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const query = (req as any).validatedQuery as DataWarehouseMetricsQuery;

  logger.info('Fetching aggregated metrics', {
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const aggregated = await DataWarehouseMetricsService.getAggregatedMetrics(query);

  res.success(aggregated, 'Aggregated metrics calculated successfully');
}));

/**
 * GET /api/datawarehouse/metrics/performance
 * Get performance KPIs and campaign rankings
 */
router.get('/performance', validatePerformanceQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const query = (req as any).validatedQuery as DataWarehouseMetricsQuery;

  logger.info('Fetching performance KPIs', {
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const performance = await DataWarehouseMetricsService.getPerformanceKPIs(query);

  res.success({
    ...performance,
    _metadata: {
      topPerformersCount: performance.topPerformers.length,
      totalCampaigns: performance.overallKPIs.totalCampaigns,
      activeCampaigns: performance.overallKPIs.activeCampaigns
    }
  }, 'Performance KPIs calculated successfully', 200);
}));

export default router;