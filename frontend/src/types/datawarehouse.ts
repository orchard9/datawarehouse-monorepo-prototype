/**
 * Data Warehouse API Types
 * Comprehensive type definitions for all API responses
 */

// Dashboard Filter Types
export interface DashboardFilters {
  search: string;
  status: 'all' | 'live' | 'paused' | 'unknown';
  dateRange: string;
  startDate?: string;
  endDate?: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  page: number;
  limit: number;
  vendors: string[];
}

// Base Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  timestamp: string;
  requestId: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Campaign Types
export interface Campaign {
  id: number;
  name: string;
  description: string;
  tracking_url: string;
  is_serving: boolean;
  serving_url: string;
  traffic_weight: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  slug: string;
  path: string | null;
  cost: number;
  cost_status?: 'estimated' | 'confirmed' | 'api_sourced';
  status: 'live' | 'paused' | 'unknown';
  sync_timestamp: string;
  first_activity_date?: string | null;
  last_activity_date?: string | null;
  metrics?: CampaignMetrics;
  hierarchy?: CampaignHierarchy;
}

export interface CampaignMetrics {
  totalSessions: number;
  totalRegistrations: number;
  totalMessages: number;
  totalConvertedUsers: number;
  totalAccounts: number;
  totalEmailAccounts: number;
  totalCreditCards: number;
  registrationRate: number;
  conversionRate: number;
  messageRate: number;
  lastActivityDate: string | null;
  dataPointCount: number;
}

export interface CampaignHierarchy {
  id: number;
  campaign_id: number;
  campaign_name: string;
  network: string;
  domain: string;
  placement: string;
  targeting: string;
  special: string;
  mapping_confidence: number;
  created_at: string;
  updated_at: string;
}

// Metrics Types
export interface HourlyMetrics {
  campaign_id: number;
  unix_hour: number;
  credit_cards: number;
  email_accounts: number;
  google_accounts: number;
  sessions: number;
  total_accounts: number;
  registrations: number;
  messages: number;
  companion_chats: number;
  chat_room_user_chats: number;
  total_user_chats: number;
  media: number;
  payment_methods: number;
  converted_users: number;
  terms_acceptances: number;
  sync_timestamp: string;
}

export interface AggregatedMetrics {
  period: string;
  totalSessions: number;
  totalRegistrations: number;
  totalMessages: number;
  totalConvertedUsers: number;
  totalAccounts: number;
  avgRegistrationRate: number;
  avgConversionRate: number;
  avgMessageRate: number;
  campaignCount: number;
}

export interface PerformanceMetrics {
  campaign_id: number;
  campaign_name: string;
  network: string;
  domain: string;
  score: number;
  metrics: {
    sessions: number;
    registrations: number;
    converted_users: number;
    registration_rate: number;
    conversion_rate: number;
  };
  rank: number;
}

// Hierarchy Types
export interface HierarchyNode {
  id: string;
  name: string;
  type: 'organization' | 'program' | 'campaign' | 'ad_set' | 'ad';
  campaignCount: number;
  children?: HierarchyNode[];
  metrics?: {
    totalSessions: number;
    totalRegistrations: number;
    totalRevenue: number;
  };
}

export interface HierarchyStats {
  totalCampaigns: number;
  mappedCampaigns: number;
  unmappedCampaigns: number;
  mappingPercentage: number;
  byNetwork: Record<string, number>;
  byDomain: Record<string, number>;
  byPlacement: Record<string, number>;
}

// Sync Types
export interface SyncStatus {
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  lastSync?: string;
  nextSync?: string;
  errors?: string[];
}

export interface SyncHistory {
  id: number;
  start_time: string;
  end_time: string;
  status: 'completed' | 'failed' | 'running';
  records_processed: number;
  records_failed: number;
  error_message?: string;
  sync_type: string;
}

// Health Check Types
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    connected: boolean;
    path: string;
    size: number;
    tables: string[];
    performance: {
      queryTime: number;
      cacheHitRate: string;
    };
  };
  dataQuality: {
    completeness: number;
    freshness: {
      hoursSinceLastSync: number;
      isStale: boolean;
    };
    recommendations: string[];
  };
  api: {
    status: string;
    version: string;
    uptime: number;
    responseTime: number;
  };
}

// Export Types
export interface ExportOptions {
  format: 'csv' | 'json';
  campaigns?: number[];
  startDate?: string;
  endDate?: string;
  includeHierarchy?: boolean;
  includeMetrics?: boolean;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

export interface ExportResult {
  url?: string;
  data?: unknown;
  filename: string;
  size: number;
  format: string;
  recordCount: number;
}

// Query Parameters Types
export interface CampaignQuery {
  page?: number;
  limit?: number;
  status?: string;
  isServing?: boolean;
  hasData?: boolean;
  search?: string;
  network?: string;
  domain?: string;
  placement?: string;
  targeting?: string;
  orderBy?: 'created_at' | 'updated_at' | 'name' | 'sessions' | 'registrations';
  orderDirection?: 'asc' | 'desc';
  includeMetrics?: boolean;
  includeHierarchy?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface MetricsQuery {
  campaignIds?: number[];
  startHour?: number;
  endHour?: number;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  limit?: number;
  page?: number;
  networks?: string[];
  domains?: string[];
  includeCalculatedFields?: boolean;
}

// Store Types for Zustand
export interface DataWarehouseState {
  // Campaigns
  campaigns: Campaign[];
  selectedCampaign: Campaign | null;
  campaignMetrics: Record<number, HourlyMetrics[]>;

  // Metrics
  aggregatedMetrics: AggregatedMetrics[];
  performanceMetrics: PerformanceMetrics[];

  // Hierarchy
  hierarchy: HierarchyNode[];
  hierarchyStats: HierarchyStats | null;

  // Sync
  syncStatus: SyncStatus | null;
  syncHistory: SyncHistory[];

  // Health
  healthCheck: HealthCheck | null;

  // UI State
  isLoading: boolean;
  error: ApiError | null;
  filters: CampaignQuery;
  pagination: PaginationMeta | null;

  // Dashboard State
  dashboardFilters: DashboardFilters;
}

// Cost Override Types
export interface CostOverride {
  id: number;
  campaign_id: number;
  cost: number;
  start_date: string;
  end_date: string;
  billing_period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  cost_status: 'confirmed' | 'api_sourced';
  override_reason?: string;
  overridden_by: string;
  overridden_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Utility Types
export type SortOrder = 'asc' | 'desc';
export type GroupBy = 'hour' | 'day' | 'week' | 'month';
export type MetricType = 'sessions' | 'registrations' | 'converted_users' | 'revenue';
export type CampaignStatus = 'active' | 'paused' | 'ended' | 'draft';
export type Network = 'google' | 'facebook' | 'tiktok' | 'native' | 'unknown';