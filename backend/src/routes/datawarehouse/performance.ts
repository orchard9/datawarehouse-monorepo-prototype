/**
 * Data Warehouse Performance Routes
 * API endpoints for hierarchical performance analytics
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ErrorUtils } from '../../utils/errors.js';
import { PerformanceService } from '../../services/performanceService.js';
import logger from '../../utils/logger.js';

const router = Router();

// Validation schema for performance query parameters
const PerformanceQuerySchema = z.object({
  display_mode: z.enum(['network', 'domain', 'placement', 'targeting', 'special'], {
    errorMap: () => ({ message: 'display_mode must be one of: network, domain, placement, targeting, special' })
  }).default('network'),
  status: z.enum(['active', 'paused', 'completed', 'all'], {
    errorMap: () => ({ message: 'status must be one of: active, paused, completed, all' })
  }).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be in YYYY-MM-DD format').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be in YYYY-MM-DD format').optional(),
  network: z.string().min(1).max(255).optional(),
  domain: z.string().min(1).max(255).optional()
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) >= new Date(data.start_date);
    }
    return true;
  },
  {
    message: "end_date must be greater than or equal to start_date",
    path: ["end_date"]
  }
);

/**
 * GET /api/datawarehouse/performance
 * Get hierarchical performance data with dynamic rollups
 *
 * Query Parameters:
 * - display_mode: Dimension to group by (network, domain, placement, targeting, special) [default: network]
 * - status: Filter by campaign status (active, paused, completed, all) [optional]
 * - start_date: Start date for data range (YYYY-MM-DD) [optional, default: 30 days ago]
 * - end_date: End date for data range (YYYY-MM-DD) [optional, default: today]
 * - network: Filter by specific network [optional]
 * - domain: Filter by specific domain [optional]
 *
 * Response Structure:
 * - For network mode: 5-level hierarchy (network → domain → placement → targeting → special)
 * - For domain mode: 4-level hierarchy (domain → placement → targeting → special)
 * - For placement mode: 3-level hierarchy (placement → targeting → special)
 * - For targeting mode: 2-level hierarchy (targeting → special)
 * - For special mode: Flat structure (individual campaigns with all dimensional context)
 *
 * Metrics:
 * - Additive (summed during rollups): cost, revenue, sales, clicks, registrations, ltrev
 * - Derived (calculated from sums): roas, lt_roas, cpr_confirm, cpr_raw, cps, rps, cpc_unique, cpc_raw
 */
router.get('/', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  // Validate query parameters
  const validationResult = PerformanceQuerySchema.safeParse(req.query);

  if (!validationResult.success) {
    logger.warn('Invalid performance query parameters', {
      errors: validationResult.error.errors,
      query: req.query
    });

    throw ErrorUtils.badRequest('Invalid query parameters', {
      errors: validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }

  const filters = validationResult.data;

  logger.info('Fetching performance data', {
    displayMode: filters.display_mode,
    status: filters.status,
    dateRange: {
      start: filters.start_date,
      end: filters.end_date
    },
    network: filters.network,
    domain: filters.domain,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  try {
    // Call performance service with validated filters
    const performanceData = await PerformanceService.getPerformanceData({
      displayMode: filters.display_mode,
      status: filters.status,
      startDate: filters.start_date,
      endDate: filters.end_date,
      network: filters.network,
      domain: filters.domain
    });

    logger.info('Performance data retrieved successfully', {
      displayMode: performanceData.displayMode,
      totalRecords: performanceData.metadata.totalRecords,
      hierarchyDepth: performanceData.hierarchyLevels.length,
      dateRange: performanceData.metadata.dateRange
    });

    res.success(performanceData, 'Performance data retrieved successfully');
  } catch (error: any) {
    logger.error('Error fetching performance data', {
      error: error.message,
      stack: error.stack,
      filters,
      displayMode: filters.display_mode
    });

    // Re-throw to be handled by global error handler
    throw error;
  }
}));

/**
 * GET /api/datawarehouse/performance/summary
 * Get high-level summary KPIs across all campaigns
 *
 * Query Parameters:
 * - status: Filter by campaign status [optional]
 * - start_date: Start date for data range (YYYY-MM-DD) [optional]
 * - end_date: End date for data range (YYYY-MM-DD) [optional]
 *
 * Response:
 * - Aggregated KPIs: total cost, revenue, sales, clicks, registrations
 * - Calculated metrics: overall ROAS, LT ROAS, average CPR, CPS, CPC
 */
router.get('/summary', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  const SummaryQuerySchema = z.object({
    status: z.enum(['active', 'paused', 'completed', 'all']).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  });

  const validationResult = SummaryQuerySchema.safeParse(req.query);

  if (!validationResult.success) {
    throw ErrorUtils.badRequest('Invalid query parameters', {
      errors: validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }

  const filters = validationResult.data;

  logger.info('Fetching performance summary', {
    status: filters.status,
    dateRange: { start: filters.start_date, end: filters.end_date }
  });

  // Get flat data (special mode) to calculate summary
  const flatData = await PerformanceService.getPerformanceData({
    displayMode: 'special',
    status: filters.status,
    startDate: filters.start_date,
    endDate: filters.end_date
  });

  // Aggregate all metrics from flat data
  let totalCost = 0;
  let totalRevenue = 0;
  let totalSales = 0;
  let totalUniqueClicks = 0;
  let totalRawClicks = 0;
  let totalConfirmReg = 0;
  let totalRawReg = 0;
  let totalLtrev = 0;

  if (Array.isArray(flatData.data)) {
    flatData.data.forEach((campaign: any) => {
      totalCost += campaign.metrics.cost;
      totalRevenue += campaign.metrics.revenue;
      totalSales += campaign.metrics.sales;
      totalUniqueClicks += campaign.metrics.uniqueClicks;
      totalRawClicks += campaign.metrics.rawClicks;
      totalConfirmReg += campaign.metrics.confirmReg;
      totalRawReg += campaign.metrics.rawReg;
      totalLtrev += campaign.metrics.ltrev;
    });
  }

  const summary = {
    totalCost,
    totalRevenue,
    totalSales,
    totalUniqueClicks,
    totalRawClicks,
    totalConfirmReg,
    totalRawReg,
    totalLtrev,
    overallRoas: totalCost > 0 ? totalRevenue / totalCost : 0,
    overallLtRoas: totalCost > 0 ? totalLtrev / totalCost : 0,
    avgCprConfirm: totalConfirmReg > 0 ? totalCost / totalConfirmReg : 0,
    avgCprRaw: totalRawReg > 0 ? totalCost / totalRawReg : 0,
    avgCps: totalSales > 0 ? totalCost / totalSales : 0,
    avgRps: totalSales > 0 ? totalRevenue / totalSales : 0,
    avgCpcUnique: totalUniqueClicks > 0 ? totalCost / totalUniqueClicks : 0,
    avgCpcRaw: totalRawClicks > 0 ? totalCost / totalRawClicks : 0,
    totalCampaigns: flatData.metadata.totalRecords,
    dateRange: flatData.metadata.dateRange,
    filtersApplied: flatData.metadata.filtersApplied
  };

  logger.info('Performance summary calculated', {
    totalCampaigns: summary.totalCampaigns,
    totalCost: summary.totalCost,
    overallRoas: summary.overallRoas
  });

  res.success(summary, 'Performance summary retrieved successfully');
}));

/**
 * GET /api/datawarehouse/performance/filters
 * Get available filter values for performance queries
 *
 * Response:
 * - List of unique networks, domains, placements, targeting options, and statuses
 * - Useful for populating filter dropdowns in the UI
 */
router.get('/filters', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  logger.info('Fetching available performance filters');

  // Get flat data to extract all unique values
  const flatData = await PerformanceService.getPerformanceData({
    displayMode: 'special'
  });

  const networks = new Set<string>();
  const domains = new Set<string>();
  const placements = new Set<string>();
  const targeting = new Set<string>();
  const statuses = new Set<string>();

  if (Array.isArray(flatData.data)) {
    flatData.data.forEach((campaign: any) => {
      if (campaign.network) networks.add(campaign.network);
      if (campaign.domain) domains.add(campaign.domain);
      if (campaign.placement) placements.add(campaign.placement);
      if (campaign.targeting) targeting.add(campaign.targeting);
      if (campaign.status) statuses.add(campaign.status);
    });
  }

  const filters = {
    networks: Array.from(networks).sort(),
    domains: Array.from(domains).sort(),
    placements: Array.from(placements).sort(),
    targeting: Array.from(targeting).sort(),
    statuses: Array.from(statuses).sort()
  };

  logger.info('Available filters retrieved', {
    networkCount: filters.networks.length,
    domainCount: filters.domains.length,
    placementCount: filters.placements.length
  });

  res.success(filters, 'Available filters retrieved successfully');
}));

export default router;
