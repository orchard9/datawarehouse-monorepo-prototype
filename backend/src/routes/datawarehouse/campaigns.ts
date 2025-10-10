/**
 * Data Warehouse Campaign Routes
 * API endpoints for campaign data and metrics
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ErrorUtils } from '../../utils/errors.js';
import { DataWarehouseCampaignService } from '../../services/dataWarehouseService.js';
import { DataWarehouseCampaignQuery, DataWarehouseMetricsQuery, CampaignActivityQuery } from '../../types/index.js';
import logger from '../../utils/logger.js';

const router = Router();

// Validation schemas
const CampaignQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
  isServing: z.string().optional().transform(val => val === undefined ? undefined : val === 'true'),
  hasData: z.string().optional().transform(val => val === undefined ? undefined : val === 'true'),
  search: z.string().min(1).max(255).optional(),
  network: z.string().optional(),
  domain: z.string().optional(),
  placement: z.string().optional(),
  targeting: z.string().optional(),
  orderBy: z.enum(['name', 'created_at', 'updated_at', 'sync_timestamp', 'traffic_weight', 'sessions', 'registrations']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
  startDate: z.string().optional(), // Allow date strings without strict datetime validation
  endDate: z.string().optional(),   // Allow date strings without strict datetime validation
  includeMetrics: z.string().optional().transform(val => val === undefined ? undefined : val === 'true'),
  includeHierarchy: z.string().optional().transform(val => val === undefined ? undefined : val === 'true')
});

const MetricsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).optional(),
  hourStart: z.coerce.number().int().min(0).max(23).optional(),
  hourEnd: z.coerce.number().int().min(0).max(23).optional(),
  includeTotals: z.coerce.boolean().optional(),
  includeCalculatedFields: z.coerce.boolean().optional()
});

const CampaignIdSchema = z.object({
  id: z.coerce.number().int().min(1)
});

const ActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  activityType: z.enum(['created', 'updated', 'paused', 'resumed', 'deleted', 'sync', 'data_received', 'hierarchy_mapped']).optional(),
  source: z.enum(['system', 'user', 'api', 'etl']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

// Validation middleware
const validateCampaignQuery = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedQuery = CampaignQuerySchema.parse(req.query);
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

const validateCampaignId = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedParams = CampaignIdSchema.parse(req.params);
    req.params = validatedParams as any;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.error('Invalid campaign ID', 400, { code: 'INVALID_CAMPAIGN_ID' });
      return;
    }
    next(error);
  }
};

const validateActivityQuery = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedQuery = ActivityQuerySchema.parse(req.query);
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
 * GET /api/datawarehouse/campaigns
 * List all campaigns with optional filtering and pagination
 */
router.get('/', validateCampaignQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const query = (req as any).validatedQuery as DataWarehouseCampaignQuery;

  logger.info('Fetching data warehouse campaigns', {
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const result = await DataWarehouseCampaignService.getCampaigns(query);

  if (result.data) {
    res.paginated(result.data, result.meta, 'Campaigns retrieved successfully');
  } else {
    res.error('Failed to retrieve campaigns', 500, 'SERVICE_ERROR');
  }
}));

/**
 * GET /api/datawarehouse/campaigns/:id
 * Get single campaign details with full metrics
 */
router.get('/:id', validateCampaignId, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.id as string);

  logger.info('Fetching data warehouse campaign details', {
    campaignId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const campaign = await DataWarehouseCampaignService.getCampaignById(campaignId);

  res.success(campaign, 'Campaign details retrieved successfully');
}));

/**
 * GET /api/datawarehouse/campaigns/:id/metrics
 * Get campaign metrics summary with optional filtering
 */
router.get('/:id/metrics', validateCampaignId, validateMetricsQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.id as string);
  const query = (req as any).validatedQuery as DataWarehouseMetricsQuery;

  logger.info('Fetching campaign metrics', {
    campaignId,
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const result = await DataWarehouseCampaignService.getCampaignMetrics(campaignId, query);

  res.success(result, 'Campaign metrics retrieved successfully');
}));

/**
 * GET /api/datawarehouse/campaigns/:id/hierarchy
 * Get campaign hierarchy with organization, program, ad sets, and ads
 */
router.get('/:id/hierarchy', validateCampaignId, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.id as string);

  logger.info('Fetching campaign hierarchy', {
    campaignId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const result = await DataWarehouseCampaignService.getCampaignHierarchy(campaignId);

  res.success(result, 'Campaign hierarchy retrieved successfully');
}));

/**
 * GET /api/datawarehouse/campaigns/:id/activity
 * Get campaign activity log with optional filtering and pagination
 */
router.get('/:id/activity', validateCampaignId, validateActivityQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.id as string);
  const query = (req as any).validatedQuery as Omit<CampaignActivityQuery, 'campaignId'>;

  // Add campaignId to query
  const activityQuery: CampaignActivityQuery = {
    ...query,
    campaignId
  };

  logger.info('Fetching campaign activity', {
    campaignId,
    query: activityQuery,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const result = await DataWarehouseCampaignService.getCampaignActivity(campaignId, activityQuery);

  if (result.data) {
    res.paginated(result.data, result.meta, 'Campaign activity retrieved successfully');
  } else {
    res.error('Failed to retrieve campaign activity', 500, 'SERVICE_ERROR');
  }
}));

export default router;