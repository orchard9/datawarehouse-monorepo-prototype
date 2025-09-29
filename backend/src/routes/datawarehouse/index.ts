/**
 * Data Warehouse API Routes
 * Main router for all data warehouse endpoints
 */

import { Router, Request, Response } from 'express';
import { ErrorUtils } from '../../utils/errors.js';
import { initializeDataWarehouseDatabase } from '../../database/datawarehouseConnection.js';
import logger from '../../utils/logger.js';

// Import route modules
import campaignRoutes from './campaigns.js';
import metricsRoutes from './metrics.js';
import hierarchyRoutes from './hierarchy.js';
import syncRoutes from './sync.js';
import exportRoutes from './export.js';

const router = Router();

// Middleware to ensure data warehouse database is connected
const ensureDataWarehouseConnection = ErrorUtils.catchAsync(async (req: Request, res: Response, next: Function): Promise<void> => {
  try {
    // This will be called on each request to ensure connection is available
    // The connection is managed as a singleton, so this is efficient
    await initializeDataWarehouseDatabase();
    next();
  } catch (error) {
    logger.error('Data warehouse database connection failed', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method
    });

    res.error(
      'Data warehouse is currently unavailable. Please try again later.',
      503,
      {
        code: 'DATABASE_UNAVAILABLE',
        service: 'data-warehouse',
        timestamp: new Date().toISOString()
      }
    );
  }
});

// Apply connection middleware to all data warehouse routes
router.use(ensureDataWarehouseConnection);

// Mount route modules
router.use('/campaigns', campaignRoutes);
router.use('/metrics', metricsRoutes);
router.use('/hierarchy', hierarchyRoutes);
router.use('/sync', syncRoutes);
router.use('/export', exportRoutes);

/**
 * GET /api/datawarehouse
 * Data warehouse API root endpoint with service information
 */
router.get('/', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  logger.info('Data warehouse API root accessed', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.success({
    service: 'Orchard9 Data Warehouse API',
    version: '1.0.0',
    description: 'Comprehensive data warehouse API for marketing campaign analytics',
    documentation: '/api/docs',
    status: 'operational',
    features: {
      campaigns: 'Campaign data management and retrieval',
      metrics: 'Performance metrics and analytics',
      hierarchy: 'Campaign hierarchy and organization structure',
      sync: 'Data synchronization monitoring and health checks',
      export: 'Data export and custom reporting'
    },
    endpoints: {
      // Campaign endpoints
      campaigns: {
        list: 'GET /api/datawarehouse/campaigns',
        details: 'GET /api/datawarehouse/campaigns/:id',
        metrics: 'GET /api/datawarehouse/campaigns/:id/metrics',
        hierarchy: 'GET /api/datawarehouse/campaigns/:id/hierarchy',
        activity: 'GET /api/datawarehouse/campaigns/:id/activity'
      },
      // Metrics endpoints
      metrics: {
        hourly: 'GET /api/datawarehouse/metrics/hourly',
        aggregated: 'GET /api/datawarehouse/metrics/aggregated',
        performance: 'GET /api/datawarehouse/metrics/performance'
      },
      // Hierarchy endpoints
      hierarchy: {
        tree: 'GET /api/datawarehouse/hierarchy',
        stats: 'GET /api/datawarehouse/hierarchy/stats',
        mapping: 'GET /api/datawarehouse/hierarchy/mapping/:campaign_id',
        organizations: 'GET /api/datawarehouse/hierarchy/organizations',
        programs: 'GET /api/datawarehouse/hierarchy/programs'
      },
      // Sync endpoints
      sync: {
        status: 'GET /api/datawarehouse/sync/status',
        history: 'GET /api/datawarehouse/sync/history',
        health: 'GET /api/datawarehouse/health',
        databaseHealth: 'GET /api/datawarehouse/health/database',
        dataQuality: 'GET /api/datawarehouse/health/data-quality'
      },
      // Export endpoints
      export: {
        csv: 'GET /api/datawarehouse/export/csv',
        json: 'GET /api/datawarehouse/export/json',
        custom: 'POST /api/datawarehouse/export/custom'
      }
    },
    capabilities: {
      filtering: 'Advanced filtering by status, network, domain, date ranges',
      pagination: 'Cursor-based pagination for large datasets',
      aggregation: 'Real-time metrics aggregation and calculations',
      hierarchical: 'Multi-level campaign hierarchy support',
      monitoring: 'Comprehensive health checks and sync monitoring',
      exporting: 'Multiple export formats (CSV, JSON) with custom reports',
      validation: 'Comprehensive input validation and error handling',
      security: 'Rate limiting, input sanitization, and security headers'
    },
    dataTypes: {
      campaigns: 'Campaign metadata and configuration',
      hourlyData: 'Hourly performance metrics and KPIs',
      hierarchy: 'Network, domain, placement, and targeting mappings',
      syncHistory: 'ETL pipeline execution history and status',
      exportHistory: 'Data export operation tracking'
    },
    performance: {
      caching: 'Optimized SQLite configuration with memory caching',
      readOnly: 'Read-only database connections for safety',
      indexing: 'Comprehensive database indexing for fast queries',
      monitoring: 'Real-time performance monitoring and alerting'
    },
    support: {
      healthChecks: 'Built-in health monitoring endpoints',
      documentation: 'Comprehensive API documentation',
      errorHandling: 'Structured error responses with detailed codes',
      logging: 'Detailed request and performance logging'
    }
  }, 'Welcome to Orchard9 Data Warehouse API');
}));

/**
 * GET /api/datawarehouse/info
 * Get data warehouse system information and statistics
 */
router.get('/info', ErrorUtils.catchAsync(async (req: Request, res: Response) => {
  logger.info('Data warehouse system info requested', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Import sync service for health check data
  const { DataWarehouseSyncService } = await import('../../services/dataWarehouseService.js');
  const healthCheck = await DataWarehouseSyncService.getHealthCheck();

  const systemInfo = {
    database: {
      type: 'SQLite',
      path: healthCheck.database.path,
      size: healthCheck.database.size,
      tables: healthCheck.database.tables,
      connected: healthCheck.database.connected,
      performance: healthCheck.database.performance
    },
    dataQuality: healthCheck.dataQuality,
    api: {
      version: '1.0.0',
      status: healthCheck.api.status,
      uptime: healthCheck.api.uptime,
      responseTime: healthCheck.api.responseTime
    },
    features: {
      readOnlyMode: true,
      realTimeMetrics: true,
      hierarchicalData: true,
      exportCapabilities: ['CSV', 'JSON', 'Custom Reports'],
      monitoringTools: ['Health Checks', 'Sync Status', 'Performance Metrics']
    },
    lastUpdated: new Date().toISOString()
  };

  res.success(systemInfo, 'Data warehouse system information retrieved successfully');
}));

export default router;