/**
 * Data Warehouse Hooks
 * React hooks for all data warehouse API operations
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { dataWarehouseApi } from '@/api/datawarehouse';
import type {
  Campaign,
  CampaignQuery,
  HourlyMetrics,
  MetricsQuery,
  ExportOptions,
  ApiError,
  PaginationMeta,
} from '@/types/datawarehouse';

// Generic hook for API calls with loading and error states
function useApiCall<T>(
  apiCall: (...args: unknown[]) => Promise<T>,
  dependencies: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (...args: unknown[]) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await apiCall(...args);
      setData(result);
      return result;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { data, loading, error, execute, setData };
}

/**
 * Campaign Hooks
 */

export function useCampaigns(query?: CampaignQuery) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCampaigns = useCallback(async (queryToUse: CampaignQuery) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const result = await dataWarehouseApi.campaigns.list(queryToUse);
      setCampaigns(result.data);
      setMeta(result.meta);
      return result;
    } catch (err) {
      // Ignore aborted requests
      if ((err as Error)?.name !== 'AbortError') {
        setError(err as ApiError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // React to query changes with debouncing to prevent too many requests
  useEffect(() => {
    if (!query) return;

    const timeoutId = setTimeout(() => {
      fetchCampaigns(query);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, fetchCampaigns]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const refresh = useCallback(() => {
    if (query) {
      return fetchCampaigns(query);
    }
  }, [fetchCampaigns, query]);

  return {
    campaigns,
    meta,
    loading,
    error,
    fetchCampaigns,
    refresh,
  };
}

export function useCampaign(campaignId: number | null) {
  const { data, loading, error, execute } = useApiCall(
    () => campaignId ? dataWarehouseApi.campaigns.getById(campaignId) : Promise.resolve(null),
    [campaignId]
  );

  useEffect(() => {
    if (campaignId) {
      execute();
    }
  }, [campaignId, execute]);

  return { campaign: data, loading, error, refetch: execute };
}

export function useCampaignMetrics(campaignId: number | null, query?: MetricsQuery) {
  const { data, loading, error, execute } = useApiCall(
    () => campaignId ? dataWarehouseApi.campaigns.getMetrics(campaignId, query) : Promise.resolve(null),
    [campaignId, query]
  );

  useEffect(() => {
    if (campaignId) {
      execute();
    }
  }, [campaignId, execute]);

  return {
    campaign: data?.campaign,
    metrics: data?.metrics || [],
    loading,
    error,
    refetch: execute
  };
}

export function useCampaignHierarchy(campaignId: number | null) {
  const { data, loading, error, execute } = useApiCall(
    () => campaignId ? dataWarehouseApi.campaigns.getHierarchy(campaignId) : Promise.resolve(null),
    [campaignId]
  );

  useEffect(() => {
    if (campaignId) {
      execute();
    }
  }, [campaignId, execute]);

  return {
    hierarchy: data?.hierarchy || null,
    relatedCampaigns: data?.relatedCampaigns || [],
    loading,
    error,
    refetch: execute
  };
}

export function useCampaignActivity(campaignId: number | null, limit = 20) {
  const { data, loading, error, execute } = useApiCall(
    () => campaignId ? dataWarehouseApi.campaigns.getActivity(campaignId, limit) : Promise.resolve(null),
    [campaignId, limit]
  );

  useEffect(() => {
    if (campaignId) {
      execute();
    }
  }, [campaignId, execute]);

  return {
    activity: data?.activity || [],
    loading,
    error,
    refetch: execute
  };
}

export function useCampaignSearch(searchTerm: string, debounceMs = 300) {
  const [results, setResults] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!searchTerm) {
      setResults([]);
      return undefined;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await dataWarehouseApi.campaigns.search(searchTerm);
        setResults(data);
      } catch (err) {
        setError(err as ApiError);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchTerm, debounceMs]);

  return { results, loading, error };
}

/**
 * Metrics Hooks
 */

export function useHourlyMetrics(query?: MetricsQuery) {
  const [metrics, setMetrics] = useState<HourlyMetrics[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const { loading, error, execute } = useApiCall(
    () => dataWarehouseApi.metrics.getHourly(query),
    [query]
  );

  const fetchMetrics = useCallback(async () => {
    const result = await execute();
    if (result) {
      setMetrics(result.data);
      setMeta(result.meta);
    }
    return result;
  }, [execute]);

  useEffect(() => {
    fetchMetrics();
  }, [query]);

  return { metrics, meta, loading, error, refetch: fetchMetrics };
}

export function useAggregatedMetrics(query?: MetricsQuery) {
  const { data, loading, error, execute } = useApiCall(
    () => dataWarehouseApi.metrics.getAggregated(query),
    [query]
  );

  useEffect(() => {
    execute();
  }, [query]);

  return { metrics: data || [], loading, error, refetch: execute };
}

export function usePerformanceMetrics(options?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const { data, loading, error, execute } = useApiCall(
    () => dataWarehouseApi.metrics.getPerformance(options),
    [options]
  );

  useEffect(() => {
    execute();
  }, [options]);

  return { metrics: data || [], loading, error, refetch: execute };
}

/**
 * Hierarchy Hooks
 */

export function useHierarchy() {
  const { data: tree, loading: treeLoading, error: treeError, execute: fetchTree } =
    useApiCall(() => dataWarehouseApi.hierarchy.getTree());

  const { data: stats, loading: statsLoading, error: statsError, execute: fetchStats } =
    useApiCall(() => dataWarehouseApi.hierarchy.getStats());

  useEffect(() => {
    fetchTree();
    fetchStats();
  }, []);

  return {
    tree: tree || [],
    stats,
    loading: treeLoading || statsLoading,
    error: treeError || statsError,
    refresh: async () => {
      await Promise.all([fetchTree(), fetchStats()]);
    },
  };
}

/**
 * Sync Hooks
 */

export function useSyncStatus(autoRefresh = false, intervalMs = 5000) {
  const { data, loading, error, execute } = useApiCall(
    () => dataWarehouseApi.sync.getStatus()
  );

  useEffect(() => {
    execute();

    if (autoRefresh) {
      const interval = setInterval(execute, intervalMs);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, intervalMs]);

  const triggerSync = useCallback(async (options?: { force?: boolean; campaigns?: number[] }) => {
    return dataWarehouseApi.sync.triggerSync(options);
  }, []);

  return { status: data, loading, error, refetch: execute, triggerSync };
}

export function useSyncHistory(limit = 20) {
  const { data, loading, error, execute } = useApiCall(
    () => dataWarehouseApi.sync.getHistory(limit),
    [limit]
  );

  useEffect(() => {
    execute();
  }, [limit]);

  return { history: data || [], loading, error, refetch: execute };
}

/**
 * Health Hooks
 */

export function useHealthCheck(autoRefresh = false, intervalMs = 30000) {
  const { data, loading, error, execute } = useApiCall(
    () => dataWarehouseApi.health.check()
  );

  useEffect(() => {
    execute();

    if (autoRefresh) {
      const interval = setInterval(execute, intervalMs);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, intervalMs]);

  const isHealthy = useMemo(() => {
    return data?.status === 'healthy';
  }, [data]);

  const isDegraded = useMemo(() => {
    return data?.status === 'degraded';
  }, [data]);

  return { health: data, isHealthy, isDegraded, loading, error, refetch: execute };
}

/**
 * Export Hooks
 */

export function useExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const exportCsv = useCallback(async (options: ExportOptions) => {
    setLoading(true);
    setError(null);
    try {
      const blob = await dataWarehouseApi.export.exportCsv(options);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export-${Date.now()}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      setError(err as ApiError);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const exportJson = useCallback(async (options: ExportOptions) => {
    setLoading(true);
    setError(null);
    try {
      const result = await dataWarehouseApi.export.exportJson(options);

      // Create JSON download
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `export-${Date.now()}.json`;
      link.click();
      window.URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      setError(err as ApiError);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateReport = useCallback(async (options: Parameters<typeof dataWarehouseApi.export.generateReport>[0]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await dataWarehouseApi.export.generateReport(options);
      return result;
    } catch (err) {
      setError(err as ApiError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { exportCsv, exportJson, generateReport, loading, error };
}

/**
 * Utility Hooks
 */

export function useFilters() {
  const { data, loading, error, execute } = useApiCall(
    () => dataWarehouseApi.utility.getFilters()
  );

  useEffect(() => {
    execute();
  }, []);

  return { filters: data, loading, error, refetch: execute };
}

// Export all hooks
export default {
  useCampaigns,
  useCampaign,
  useCampaignMetrics,
  useCampaignHierarchy,
  useCampaignActivity,
  useCampaignSearch,
  useHourlyMetrics,
  useAggregatedMetrics,
  usePerformanceMetrics,
  useHierarchy,
  useSyncStatus,
  useSyncHistory,
  useHealthCheck,
  useExport,
  useFilters,
};