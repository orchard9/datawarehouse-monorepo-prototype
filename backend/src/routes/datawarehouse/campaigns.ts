/**
 * Data Warehouse Campaign Routes
 * API endpoints for campaign data and metrics
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ErrorUtils } from '../../utils/errors.js';
import { DataWarehouseCampaignService, DataWarehouseHierarchyOverrideService } from '../../services/dataWarehouseService.js';
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
  startDate: z.string().optional(), // Allow date strings without strict datetime validation
  endDate: z.string().optional(),   // Allow date strings without strict datetime validation
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

const HierarchyOverrideSchema = z.object({
  network: z.string().min(1).max(255).optional(),
  domain: z.string().min(1).max(255).optional(),
  placement: z.string().min(1).max(255).optional(),
  targeting: z.string().min(1).max(255).optional(),
  special: z.string().min(1).max(255).optional(),
  override_reason: z.string().min(1).max(500).optional(),
  overridden_by: z.string().min(1).max(255)
}).refine(
  (data) => data.network || data.domain || data.placement || data.targeting || data.special,
  {
    message: "At least one hierarchy field (network, domain, placement, targeting, special) must be provided"
  }
);

const HierarchyHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const CampaignCostUpdateSchema = z.object({
  cost: z.number().min(0, 'Cost must be a non-negative number')
});

const CampaignStatusUpdateSchema = z.object({
  status: z.enum(['live', 'paused', 'unknown'], {
    errorMap: () => ({ message: 'Status must be one of: live, paused, unknown' })
  })
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

const validateHierarchyOverride = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedBody = HierarchyOverrideSchema.parse(req.body);
    (req as any).validatedBody = validatedBody;
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

const validateHierarchyHistoryQuery = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedQuery = HierarchyHistoryQuerySchema.parse(req.query);
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

const validateCampaignCostUpdate = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedBody = CampaignCostUpdateSchema.parse(req.body);
    (req as any).validatedBody = validatedBody;
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

const validateCampaignStatusUpdate = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedBody = CampaignStatusUpdateSchema.parse(req.body);
    (req as any).validatedBody = validatedBody;
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

/**
 * PATCH /api/datawarehouse/campaigns/:id/cost
 * Update campaign cost
 */
router.patch('/:id/cost', validateCampaignId, validateCampaignCostUpdate, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.id as string);
  const { cost } = (req as any).validatedBody;

  logger.info('Updating campaign cost', {
    campaignId,
    cost,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const updatedCampaign = await DataWarehouseCampaignService.updateCampaignCost(campaignId, cost);

  res.success(updatedCampaign, 'Campaign cost updated successfully');
}));

/**
 * PATCH /api/datawarehouse/campaigns/:id/status
 * Update campaign status
 */
router.patch('/:id/status', validateCampaignId, validateCampaignStatusUpdate, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.id as string);
  const { status } = (req as any).validatedBody;

  logger.info('Updating campaign status', {
    campaignId,
    status,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const updatedCampaign = await DataWarehouseCampaignService.updateCampaignStatus(campaignId, status);

  res.success(updatedCampaign, 'Campaign status updated successfully');
}));

/**
 * PATCH /api/datawarehouse/campaigns/:id/hierarchy
 * Update campaign hierarchy with manual override
 */
router.patch('/:id/hierarchy', validateCampaignId, validateHierarchyOverride, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.id as string);
  const overrideData = (req as any).validatedBody;

  logger.info('Updating campaign hierarchy override', {
    campaignId,
    overrideData,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const result = await DataWarehouseHierarchyOverrideService.updateHierarchyOverride(campaignId, overrideData);

  res.success(result, 'Campaign hierarchy override updated successfully');
}));

/**
 * DELETE /api/datawarehouse/campaigns/:id/hierarchy/override
 * Delete (deactivate) campaign hierarchy override
 */
router.delete('/:id/hierarchy/override', validateCampaignId, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.id as string);
  const overridden_by = req.body.overridden_by || 'system';

  logger.info('Deleting campaign hierarchy override', {
    campaignId,
    overridden_by,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const result = await DataWarehouseHierarchyOverrideService.deleteHierarchyOverride(campaignId, overridden_by);

  res.success(result, 'Campaign hierarchy override deleted successfully');
}));

/**
 * GET /api/datawarehouse/campaigns/:id/hierarchy/history
 * Get campaign hierarchy override history
 */
router.get('/:id/hierarchy/history', validateCampaignId, validateHierarchyHistoryQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.id as string);
  const query = (req as any).validatedQuery;
  const limit = query?.limit || 10;

  logger.info('Fetching campaign hierarchy override history', {
    campaignId,
    limit,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const result = await DataWarehouseHierarchyOverrideService.getHierarchyOverrideHistory(campaignId, limit);

  res.success(result, 'Campaign hierarchy override history retrieved successfully');
}));

export default router;