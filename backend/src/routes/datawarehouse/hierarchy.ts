/**
 * Data Warehouse Hierarchy Routes
 * API endpoints for campaign hierarchy and organization structure
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ErrorUtils } from '../../utils/errors.js';
import { DataWarehouseHierarchyService } from '../../services/dataWarehouseService.js';
import { HierarchyQuery } from '../../types/index.js';
import logger from '../../utils/logger.js';

const router = Router();

// Validation schemas
const HierarchyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  network: z.string().optional(),
  domain: z.string().optional(),
  placement: z.string().optional(),
  targeting: z.string().optional(),
  special: z.string().optional(),
  mappingConfidenceMin: z.coerce.number().min(0).max(1).optional(),
  hasMapping: z.coerce.boolean().optional(),
  search: z.string().min(1).max(255).optional()
});

const CampaignIdSchema = z.object({
  campaign_id: z.coerce.number().int().min(1)
});

// Validation middleware
const validateHierarchyQuery = (req: Request, res: Response, next: Function): void => {
  try {
    const validatedQuery = HierarchyQuerySchema.parse(req.query);
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

/**
 * GET /api/datawarehouse/hierarchy
 * Get complete hierarchy tree structure
 */
router.get('/', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  logger.info('Fetching hierarchy tree', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const hierarchyTree = await DataWarehouseHierarchyService.getHierarchyTree();

  res.success({
    ...hierarchyTree,
    _metadata: {
      networksCount: hierarchyTree.networks.length,
      mappingCoverage: hierarchyTree.totalCampaigns > 0
        ? Math.round(((hierarchyTree.totalCampaigns - hierarchyTree.unmappedCampaigns) / hierarchyTree.totalCampaigns) * 100 * 100) / 100
        : 0
    }
  }, 'Hierarchy tree retrieved successfully', 200);
}));

/**
 * GET /api/datawarehouse/hierarchy/stats
 * Get hierarchy mapping statistics
 */
router.get('/stats', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  logger.info('Fetching hierarchy mapping stats', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const stats = await DataWarehouseHierarchyService.getHierarchyMappingStats();

  res.success(stats, 'Hierarchy mapping statistics retrieved successfully');
}));

/**
 * GET /api/datawarehouse/hierarchy/mapping/:campaign_id
 * Get campaign hierarchy mapping for specific campaign
 */
router.get('/mapping/:campaign_id', validateCampaignId, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const campaignId = parseInt(req.params.campaign_id as string);

  logger.info('Fetching campaign hierarchy mapping', {
    campaignId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const mapping = await DataWarehouseHierarchyService.getCampaignHierarchyMapping(campaignId);

  if (!mapping) {
    res.error('No hierarchy mapping found for this campaign', 404, {
      code: 'MAPPING_NOT_FOUND',
      campaignId
    });
    return;
  }

  res.success(mapping, 'Campaign hierarchy mapping retrieved successfully');
}));

/**
 * GET /api/datawarehouse/organizations
 * Get organization list (derived from hierarchy data)
 */
router.get('/organizations', validateHierarchyQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const query = req.query as HierarchyQuery;

  logger.info('Fetching organizations from hierarchy', {
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Get the hierarchy tree and extract organizations (networks in our case)
  const hierarchyTree = await DataWarehouseHierarchyService.getHierarchyTree();

  // Transform networks into organization-like structure
  const organizations = hierarchyTree.networks.map((network, index) => ({
    id: index + 1, // Generate ID for compatibility
    name: network.network,
    campaignCount: network.campaignCount,
    domainCount: network.domains.length,
    placementCount: network.domains.reduce((total, domain) => total + domain.placements.length, 0),
    created_at: new Date().toISOString(), // Placeholder
    updated_at: new Date().toISOString()  // Placeholder
  }));

  // Apply search filter if provided
  let filteredOrganizations = organizations;
  if (query.search) {
    const searchTerm = query.search.toLowerCase();
    filteredOrganizations = organizations.filter(org =>
      org.name.toLowerCase().includes(searchTerm)
    );
  }

  // Apply network filter if provided
  if (query.network) {
    filteredOrganizations = filteredOrganizations.filter(org =>
      org.name.toLowerCase().includes(query.network?.toLowerCase() ?? '')
    );
  }

  // Apply pagination
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;
  const total = filteredOrganizations.length;

  const paginatedOrganizations = filteredOrganizations.slice(offset, offset + limit);

  const meta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1
  };

  res.paginated(paginatedOrganizations, meta, 'Organizations retrieved successfully');
}));

/**
 * GET /api/datawarehouse/programs
 * Get program list (derived from hierarchy data)
 */
router.get('/programs', validateHierarchyQuery, ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const query = req.query as HierarchyQuery;

  logger.info('Fetching programs from hierarchy', {
    query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Get the hierarchy tree and extract programs (domains in our case)
  const hierarchyTree = await DataWarehouseHierarchyService.getHierarchyTree();

  // Transform domains into program-like structure
  const programs: any[] = [];
  let programId = 1;

  for (const network of hierarchyTree.networks) {
    for (const domain of network.domains) {
      // Apply network filter if provided
      if (query.network && network.network.toLowerCase() !== query.network.toLowerCase()) {
        continue;
      }

      // Apply domain filter if provided
      if (query.domain && domain.domain.toLowerCase() !== query.domain.toLowerCase()) {
        continue;
      }

      programs.push({
        id: programId++,
        organization_id: network.network, // Use network name as org reference
        name: domain.domain,
        description: `Domain: ${domain.domain} under ${network.network}`,
        network: network.network,
        campaignCount: domain.campaignCount,
        placementCount: domain.placements.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  // Apply search filter if provided
  let filteredPrograms = programs;
  if (query.search) {
    const searchTerm = query.search.toLowerCase();
    filteredPrograms = programs.filter(program =>
      program.name.toLowerCase().includes(searchTerm) ||
      program.network.toLowerCase().includes(searchTerm)
    );
  }

  // Apply pagination
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;
  const total = filteredPrograms.length;

  const paginatedPrograms = filteredPrograms.slice(offset, offset + limit);

  const meta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1
  };

  res.paginated(paginatedPrograms, meta, 'Programs retrieved successfully');
}));

export default router;