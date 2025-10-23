/**
 * Data Warehouse API Service
 * All data warehouse API endpoints
 */

import { api } from './client';
import type {
  Campaign,
  CampaignQuery,
  HourlyMetrics,
  MetricsQuery,
  AggregatedMetrics,
  PerformanceMetrics,
  HierarchyNode,
  HierarchyStats,
  SyncStatus,
  SyncHistory,
  HealthCheck,
  ExportOptions,
  ExportResult,
} from '@/types/datawarehouse';

// Base API path
const BASE_PATH = '/api/datawarehouse';

/**
 * Campaign API endpoints
 */
export const campaignApi = {
  /**
   * Get paginated list of campaigns
   */
  async list(query?: CampaignQuery) {
    return api.getPaginated<Campaign>(`${BASE_PATH}/campaigns`, query as Record<string, unknown>);
  },

  /**
   * Get single campaign by ID
   */
  async getById(id: number) {
    return api.get<Campaign>(`${BASE_PATH}/campaigns/${id}`);
  },

  /**
   * Get campaign metrics
   */
  async getMetrics(id: number, query?: MetricsQuery) {
    return api.get<{ campaign: Campaign; metrics: HourlyMetrics[] }>(
      `${BASE_PATH}/campaigns/${id}/metrics`,
      query as Record<string, unknown>
    );
  },

  /**
   * Search campaigns
   */
  async search(searchTerm: string, limit = 10) {
    return api.get<Campaign[]>(`${BASE_PATH}/campaigns/search`, {
      q: searchTerm,
      limit,
    });
  },

  /**
   * Get top performing campaigns
   */
  async getTopPerformers(limit = 10, metric: 'sessions' | 'registrations' | 'revenue' = 'sessions') {
    return api.get<PerformanceMetrics[]>(`${BASE_PATH}/campaigns/top-performers`, {
      limit,
      metric,
    });
  },

  /**
   * Get campaign hierarchy details (ad sets and ads)
   */
  async getHierarchy(id: number) {
    return api.get<{
      campaign: Campaign;
      hierarchy: {
        organization: string;
        program: string;
        campaign: string;
        adSets: Array<{
          id: string;
          name: string;
          targeting: string;
          metrics: {
            sessions: number;
            registrations: number;
            conversions: number;
          };
        }>;
        ads: Array<{
          id: string;
          name: string;
          creative: string;
          metrics: {
            sessions: number;
            registrations: number;
            conversions: number;
          };
        }>;
      };
      relatedCampaigns: Campaign[];
    }>(`${BASE_PATH}/campaigns/${id}/hierarchy`);
  },

  /**
   * Get campaign activity log
   */
  async getActivity(id: number, page = 1, limit = 20) {
    return api.getPaginated<{
      id: number;
      campaign_id: number;
      activity_type: 'sync' | 'hierarchy_update' | 'status_change' | 'cost_update' | 'cost_delete' | 'data_received' | 'manual_edit';
      description: string;
      metadata?: Record<string, unknown>;
      created_at: string;
      user_id?: string;
      source: 'system' | 'web_ui' | 'api' | 'etl';
    }>(`${BASE_PATH}/campaigns/${id}/activity`, { page, limit });
  },

  /**
   * Update campaign hierarchy override
   */
  async updateHierarchyOverride(
    id: number,
    data: {
      network?: string;
      domain?: string;
      placement?: string;
      targeting?: string;
      special?: string;
      override_reason?: string;
      overridden_by: string;
    }
  ) {
    return api.patch<{
      success: boolean;
      hierarchy: {
        network: string;
        domain: string;
        placement: string;
        targeting: string;
        special: string;
        has_override: boolean;
        override_reason?: string;
        overridden_by?: string;
        overridden_at?: string;
      };
    }>(`${BASE_PATH}/campaigns/${id}/hierarchy`, data);
  },

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    id: number,
    data: {
      status: 'live' | 'paused' | 'unknown';
    }
  ) {
    return api.patch<{
      success: boolean;
      campaign: Campaign;
    }>(`${BASE_PATH}/campaigns/${id}/status`, data);
  },

  /**
   * Update campaign cost (with date range)
   */
  async updateCampaignCost(
    id: number,
    data: {
      cost: number;
      cost_status?: 'confirmed' | 'api_sourced';
      start_date: string;
      end_date: string;
      billing_period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
      override_reason?: string;
      overridden_by: string;
    }
  ) {
    return api.patch<{
      success: boolean;
      campaign: Campaign;
    }>(`${BASE_PATH}/campaigns/${id}/cost`, data);
  },

  /**
   * Get campaign cost breakdown for a date range
   */
  async getCostBreakdown(
    id: number,
    startDate: string,
    endDate: string
  ) {
    return api.get<{
      total_cost: number;
      breakdown: Array<{
        start_date: string;
        end_date: string;
        cost: number;
        daily_rate: number;
        days: number;
        cost_status: string;
        billing_period?: string;
        override_id?: number;
      }>;
    }>(`${BASE_PATH}/campaigns/${id}/cost/breakdown`, {
      startDate,
      endDate,
    });
  },

  /**
   * Delete campaign cost override
   */
  async deleteCostOverride(
    id: number,
    data: {
      overridden_by: string;
    }
  ) {
    return api.delete<{
      success: boolean;
    }>(`${BASE_PATH}/campaigns/${id}/cost/override`, data);
  },
};

/**
 * Metrics API endpoints
 */
export const metricsApi = {
  /**
   * Get hourly metrics
   */
  async getHourly(query?: MetricsQuery) {
    return api.getPaginated<HourlyMetrics>(`${BASE_PATH}/metrics/hourly`, query as Record<string, unknown>);
  },

  /**
   * Get aggregated metrics
   */
  async getAggregated(query?: MetricsQuery) {
    return api.get<AggregatedMetrics[]>(`${BASE_PATH}/metrics/aggregated`, query as Record<string, unknown>);
  },

  /**
   * Get performance rankings
   */
  async getPerformance(query?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    return api.get<PerformanceMetrics[]>(`${BASE_PATH}/metrics/performance`, query);
  },

  /**
   * Get trend data
   */
  async getTrends(query?: {
    campaignIds?: number[];
    metric: 'sessions' | 'registrations' | 'converted_users';
    groupBy?: 'hour' | 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
  }) {
    return api.get<Record<string, unknown>[]>(`${BASE_PATH}/metrics/trends`, query as Record<string, unknown>);
  },

  /**
   * Compare performance between campaigns
   */
  async compare(campaignIds: number[], startDate?: string, endDate?: string) {
    return api.get<Record<string, unknown>>(`${BASE_PATH}/metrics/compare`, {
      campaignIds: campaignIds.join(','),
      startDate,
      endDate,
    });
  },
};

/**
 * Hierarchy API endpoints
 */
export const hierarchyApi = {
  /**
   * Get full hierarchy tree
   */
  async getTree() {
    return api.get<HierarchyNode[]>(`${BASE_PATH}/hierarchy`);
  },

  /**
   * Get hierarchy statistics
   */
  async getStats() {
    return api.get<HierarchyStats>(`${BASE_PATH}/hierarchy/stats`);
  },

  /**
   * Get campaign hierarchy mapping
   */
  async getMapping(campaignId: number) {
    return api.get<Record<string, unknown>>(`${BASE_PATH}/hierarchy/mapping/${campaignId}`);
  },

  /**
   * Get organizations list
   */
  async getOrganizations() {
    return api.get<Record<string, unknown>[]>(`${BASE_PATH}/hierarchy/organizations`);
  },

  /**
   * Get programs for an organization
   */
  async getPrograms(organizationId?: string) {
    return api.get<Record<string, unknown>[]>(`${BASE_PATH}/hierarchy/programs`, {
      organizationId,
    });
  },
};

/**
 * Sync API endpoints
 */
export const syncApi = {
  /**
   * Get current sync status
   */
  async getStatus() {
    return api.get<SyncStatus>(`${BASE_PATH}/sync/status`);
  },

  /**
   * Get sync history
   */
  async getHistory(limit = 20) {
    return api.get<SyncHistory[]>(`${BASE_PATH}/sync/history`, { limit });
  },

  /**
   * Trigger manual sync
   */
  async triggerSync(options?: {
    force?: boolean;
    campaigns?: number[];
  }) {
    return api.post<{ success: boolean; jobId: string }>(`${BASE_PATH}/sync/trigger`, options);
  },

  /**
   * Get sync job status
   */
  async getJobStatus(jobId: string) {
    return api.get<Record<string, unknown>>(`${BASE_PATH}/sync/jobs/${jobId}`);
  },
};

/**
 * Health API endpoints
 */
export const healthApi = {
  /**
   * Get system health check
   */
  async check() {
    return api.get<HealthCheck>(`${BASE_PATH}/health`);
  },

  /**
   * Get database health
   */
  async getDatabaseHealth() {
    return api.get<Record<string, unknown>>(`${BASE_PATH}/health/database`);
  },

  /**
   * Get data quality metrics
   */
  async getDataQuality() {
    return api.get<Record<string, unknown>>(`${BASE_PATH}/health/data-quality`);
  },

  /**
   * Get API status
   */
  async getApiStatus() {
    return api.get<Record<string, unknown>>(`${BASE_PATH}/health/api`);
  },
};

/**
 * Export API endpoints
 */
export const exportApi = {
  /**
   * Export data as CSV
   */
  async exportCsv(options: ExportOptions) {
    const blob = await api.download(`${BASE_PATH}/export/csv`, options as unknown as Record<string, unknown>);
    return blob;
  },

  /**
   * Export data as JSON
   */
  async exportJson(options: ExportOptions) {
    return api.get<ExportResult>(`${BASE_PATH}/export/json`, options as unknown as Record<string, unknown>);
  },

  /**
   * Generate custom report
   */
  async generateReport(options: {
    reportType: 'performance' | 'comparison' | 'trend' | 'executive';
    campaigns?: number[];
    startDate?: string;
    endDate?: string;
    format?: 'pdf' | 'xlsx' | 'csv';
  }) {
    return api.post<ExportResult>(`${BASE_PATH}/export/custom`, options);
  },

  /**
   * Get export history
   */
  async getHistory(limit = 20) {
    return api.get<Record<string, unknown>[]>(`${BASE_PATH}/export/history`, { limit });
  },
};

/**
 * Utility API endpoints
 */
export const utilityApi = {
  /**
   * Get API info
   */
  async getInfo() {
    return api.get<Record<string, unknown>>(`${BASE_PATH}/info`);
  },

  /**
   * Get available filters
   */
  async getFilters() {
    return api.get<{
      networks: string[];
      domains: string[];
      placements: string[];
      targetings: string[];
    }>(`${BASE_PATH}/filters`);
  },

  /**
   * Validate campaign data
   */
  async validateCampaign(campaignId: number) {
    return api.get<{
      valid: boolean;
      issues: string[];
    }>(`${BASE_PATH}/validate/${campaignId}`);
  },
};

// Export all API modules
export const dataWarehouseApi = {
  campaigns: campaignApi,
  metrics: metricsApi,
  hierarchy: hierarchyApi,
  sync: syncApi,
  health: healthApi,
  export: exportApi,
  utility: utilityApi,
};