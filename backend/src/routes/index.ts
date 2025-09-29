/**
 * API routes index
 * Centralized route configuration for the application
 */

import { Router } from 'express';
import healthRoutes from './health.js';
// import campaignRoutes from './campaigns.js';
// import metricsRoutes from './metrics.js';
// import organizationRoutes from './organizations.js';
// import adsRoutes from './ads.js';
import datawarehouseRoutes from './datawarehouse/index.js';

const router = Router();

// Mount routes with proper prefixes
router.use('/health', healthRoutes);
// TODO: Fix service instantiation at module level for these routes:
// router.use('/api/campaigns', campaignRoutes);
// router.use('/api/metrics', metricsRoutes);
// router.use('/api/organizations', organizationRoutes);
// router.use('/api', adsRoutes);

// Data warehouse routes are properly implemented with lazy loading:
router.use('/api/datawarehouse', datawarehouseRoutes);

// API root endpoint
router.get('/api', (_req, res) => {
  res.success({
    service: 'Orchard9 Data Warehouse API',
    version: '1.0.0',
    description: 'Enterprise marketing analytics data warehouse API',
    documentation: '/api/docs',
    endpoints: {
      health: '/health',
      healthDetailed: '/health/detailed',
      healthDatabase: '/health/database',
      campaigns: '/api/campaigns',
      metrics: '/api/metrics',
      organizations: '/api/organizations',
      datawarehouse: '/api/datawarehouse'
    },
    features: [
      'Campaign performance analytics',
      'Hierarchical campaign structure',
      'Campaign activity logging and tracking',
      'Real-time metrics aggregation',
      'Performance comparison tools',
      'Trend analysis',
      'Top performer rankings',
      'Data warehouse integration',
      'Comprehensive health monitoring',
      'Multi-format data export',
      'Custom report generation'
    ]
  }, 'Welcome to Orchard9 Data Warehouse API');
});

export default router;