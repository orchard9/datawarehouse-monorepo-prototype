/**
 * Core TypeScript type definitions for Orchard9 Data Warehouse Backend
 */

// Environment configuration types
export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  databasePath: string;
  logLevel: 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';
  corsOrigin: string | string[] | boolean;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

// Database entity types (based on the data warehouse schema)
export interface Organization {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: number;
  program_id: number;
  name: string;
  status: string;
  objective?: string;
  created_at: string;
  updated_at: string;
  start_date?: string;
  end_date?: string;
}

export interface AdSet {
  id: number;
  campaign_id: number;
  name: string;
  status: string;
  targeting?: string;
  created_at: string;
  updated_at: string;
}

export interface Ad {
  id: number;
  ad_set_id: number;
  name: string;
  status: string;
  creative_type?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignMetrics {
  id: number;
  campaign_id: number;
  date: string;
  hour: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  created_at: string;
  updated_at: string;
}

// Data Warehouse specific entity types (based on actual schema)
export interface DataWarehouseCampaign {
  id: number;
  name: string;
  description?: string;
  tracking_url?: string;
  is_serving: boolean;
  serving_url?: string;
  traffic_weight: number;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  slug?: string;
  path?: string;
  sync_timestamp: string;
}

export interface HourlyData {
  campaign_id: number;
  unix_hour: number;
  // Registration data
  credit_cards: number;
  email_accounts: number;
  google_accounts: number;
  sessions: number;
  total_accounts: number;
  registrations: number;
  // Messages data
  messages: number;
  companion_chats: number;
  chat_room_user_chats: number;
  total_user_chats: number;
  // Other metrics
  media: number;
  payment_methods: number;
  converted_users: number;
  terms_acceptances: number;
  sync_timestamp: string;
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

export interface HierarchyRule {
  id: number;
  rule_name: string;
  pattern_type: 'regex' | 'contains' | 'starts_with' | 'ends_with';
  pattern_value: string;
  network?: string;
  domain?: string;
  placement?: string;
  targeting?: string;
  special?: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncHistory {
  id: number;
  sync_type: 'campaigns' | 'metrics' | 'reports' | 'full';
  start_time: string;
  end_time?: string;
  status: 'running' | 'completed' | 'failed';
  records_processed: number;
  records_inserted: number;
  records_updated: number;
  error_message?: string;
  api_calls_made: number;
  created_at: string;
}

export interface ExportHistory {
  id: number;
  export_type: 'google_sheets' | 'csv' | 'excel';
  export_config?: string; // JSON config
  file_path?: string;
  sheet_url?: string;
  records_exported: number;
  status: 'running' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

// Request validation types
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface DateRangeQuery {
  startDate?: string | undefined;
  endDate?: string | undefined;
}

export interface CampaignQuery extends PaginationQuery, DateRangeQuery {
  status?: string;
  organizationId?: number;
  programId?: number;
}

export interface MetricsQuery extends DateRangeQuery {
  campaignId?: number | undefined;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  aggregateBy?: 'sum' | 'avg' | 'min' | 'max';
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  code?: string | undefined;
  details?: any;
  isOperational?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Health check types
export interface HealthCheckResult {
  status: 'OK' | 'ERROR';
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  database: {
    connected: boolean;
    path: string;
    size?: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  environment: string;
}

// Database connection types
export interface DatabaseConfig {
  path: string;
  options?: {
    verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
  };
}

// Logger types
export interface LoggerMeta {
  requestId?: string;
  userId?: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  stack?: string | undefined;
  code?: string | undefined;
  isOperational?: boolean;
  contentLength?: string | undefined;
  referer?: string | undefined;
  providedApiKey?: string;
  [key: string]: any;
}

// Express middleware types
export interface RequestWithId extends Express.Request {
  id: string;
}

// Analytics types for aggregated data
export interface CampaignSummary {
  campaign: Campaign;
  metrics: {
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    totalSpend: number;
    totalRevenue: number;
    avgCtr: number;
    avgCpc: number;
    avgCpm: number;
    avgRoas: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface PerformanceMetrics {
  period: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
}

// Export/Import types
export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  includeMetrics?: boolean;
  dateRange?: DateRangeQuery;
  campaignIds?: number[];
}

export interface ImportResult {
  success: boolean;
  recordsProcessed: number;
  recordsImported: number;
  errors: string[];
}

// Data Warehouse specific query types
export interface DataWarehouseCampaignQuery extends PaginationQuery, DateRangeQuery {
  status?: string;
  isServing?: boolean;
  hasData?: boolean;
  search?: string;
  network?: string;
  domain?: string;
  placement?: string;
  targeting?: string;
  orderBy?: 'name' | 'created_at' | 'updated_at' | 'sync_timestamp' | 'traffic_weight' | 'sessions' | 'registrations';
  orderDirection?: 'asc' | 'desc';
}

export interface DataWarehouseMetricsQuery extends DateRangeQuery {
  campaignId?: number;
  campaignIds?: number[];
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  aggregateBy?: 'sum' | 'avg' | 'min' | 'max';
  hourStart?: number;
  hourEnd?: number;
  includeTotals?: boolean;
  includeCalculatedFields?: boolean;
}

export interface HierarchyQuery extends PaginationQuery {
  network?: string;
  domain?: string;
  placement?: string;
  targeting?: string;
  special?: string;
  mappingConfidenceMin?: number;
  hasMapping?: boolean;
  search?: string;
}

export interface SyncStatusQuery {
  syncType?: 'campaigns' | 'metrics' | 'reports' | 'full';
  status?: 'running' | 'completed' | 'failed';
  limit?: number;
  includeCurrent?: boolean;
}

export interface ExportQuery {
  format: 'csv' | 'json';
  campaignIds?: number[];
  includeHierarchy?: boolean;
  includeMetrics?: boolean;
  aggregateMetrics?: boolean;
  dateRange?: DateRangeQuery;
  customFields?: string[];
}

// Data Warehouse specific response types
export interface DataWarehouseCampaignWithMetrics extends DataWarehouseCampaign {
  hierarchy?: CampaignHierarchy;
  metrics?: {
    totalSessions: number;
    totalRegistrations: number;
    totalMessages: number;
    totalConvertedUsers: number;
    totalAccounts: number;
    registrationRate: number;
    conversionRate: number;
    messageRate: number;
    lastActivityDate: string | null;
    dataPointCount: number;
  };
}

export interface AggregatedMetrics {
  period: string;
  campaignCount: number;
  totalSessions: number;
  totalRegistrations: number;
  totalMessages: number;
  totalConvertedUsers: number;
  totalAccounts: number;
  totalCreditCards: number;
  totalEmailAccounts: number;
  totalGoogleAccounts: number;
  totalCompanionChats: number;
  totalChatRoomUserChats: number;
  totalMedia: number;
  totalPaymentMethods: number;
  totalTermsAcceptances: number;
  // Calculated rates
  avgRegistrationRate: number;
  avgConversionRate: number;
  avgMessageRate: number;
  avgAccountCreationRate: number;
}

export interface HourlyMetricsSummary {
  unix_hour: number;
  hour_date: string;
  campaign_count: number;
  metrics: Omit<HourlyData, 'campaign_id' | 'unix_hour' | 'sync_timestamp'>;
}

export interface CampaignPerformanceRanking {
  campaign: DataWarehouseCampaign;
  hierarchy?: CampaignHierarchy;
  rank: number;
  score: number;
  metrics: {
    sessions: number;
    registrations: number;
    messages: number;
    convertedUsers: number;
    registrationRate: number;
    conversionRate: number;
    messageRate: number;
  };
}

export interface HierarchyMappingStats {
  totalCampaigns: number;
  mappedCampaigns: number;
  unmappedCampaigns: number;
  mappingCoverage: number;
  networks: Array<{
    network: string;
    count: number;
    percentage: number;
  }>;
  domains: Array<{
    domain: string;
    count: number;
    percentage: number;
  }>;
  placements: Array<{
    placement: string;
    count: number;
    percentage: number;
  }>;
  confidenceDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
}

export interface SyncStatusResponse {
  current: {
    isRunning: boolean;
    syncType?: string;
    startTime?: string;
    progress?: number;
  };
  recent: SyncHistory[];
  summary: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    lastSuccessfulSync?: string;
    lastFailedSync?: string;
    avgRecordsProcessed: number;
    avgSyncDuration: number;
  };
}

export interface DataWarehouseHealthCheck {
  database: {
    connected: boolean;
    path: string;
    size: number | null;
    tables: string[];
    tableCounts: Record<string, number>;
    lastSync: string | null;
    dataFreshness: {
      hoursSinceLastSync: number | null;
      isStale: boolean;
    };
    performance: {
      queryTime: number;
      cacheHitRate: string;
    };
  };
  dataQuality: {
    campaignsWithData: number;
    campaignsWithoutData: number;
    dataCompleteness: number;
    hierarchyMappingCoverage: number;
    recentDataPoints: number;
    oldestDataPoint: string | null;
    newestDataPoint: string | null;
  };
  api: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    uptime: number;
  };
}

// Campaign Activity Log types
export interface CampaignActivity {
  id: number;
  campaign_id: number;
  activity_type: 'created' | 'updated' | 'paused' | 'resumed' | 'deleted' | 'sync' | 'data_received' | 'hierarchy_mapped';
  description: string;
  metadata?: {
    [key: string]: any;
  };
  created_at: string;
  user_id?: string;
  source: 'system' | 'user' | 'api' | 'etl';
}

export interface CampaignActivityQuery extends PaginationQuery {
  campaignId: number;
  activityType?: CampaignActivity['activity_type'];
  source?: CampaignActivity['source'];
  startDate?: string;
  endDate?: string;
}

// Campaign hierarchy response for /api/campaigns/:id/hierarchy
export interface CampaignHierarchyResponse {
  campaign: DataWarehouseCampaignWithMetrics;
  hierarchy: CampaignHierarchy | null;
  organization: {
    id: number;
    name: string;
    created_at: string;
  } | null;
  program: {
    id: number;
    name: string;
    description?: string;
    created_at: string;
  } | null;
  adSets: Array<{
    id: number;
    name: string;
    status: string;
    targeting?: string;
    created_at: string;
    adCount: number;
  }>;
  ads: Array<{
    id: number;
    ad_set_id: number;
    name: string;
    status: string;
    creative_type?: string;
    created_at: string;
  }>;
}