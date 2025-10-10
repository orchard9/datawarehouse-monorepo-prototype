/**
 * API Module
 * Central export for all API functionality
 */

// Export client
export { api, apiClient } from './client';
export type { ApiError } from './client';

// Export data warehouse API
export { dataWarehouseApi } from './datawarehouse';
export {
  campaignApi,
  metricsApi,
  hierarchyApi,
  syncApi,
  healthApi,
  exportApi,
  utilityApi,
} from './datawarehouse';

// Re-export types for convenience
export type {
  Campaign,
  CampaignQuery,
  CampaignMetrics,
  CampaignHierarchy,
  HourlyMetrics,
  AggregatedMetrics,
  PerformanceMetrics,
  HierarchyNode,
  HierarchyStats,
  SyncStatus,
  SyncHistory,
  HealthCheck,
  ExportOptions,
  ExportResult,
  MetricsQuery,
  ApiResponse,
  PaginatedResponse,
  PaginationMeta,
} from '@/types/datawarehouse';