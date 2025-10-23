/**
 * Data Warehouse Store
 * Zustand store for global data warehouse state management
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { dataWarehouseApi } from '@/api/datawarehouse';
import type {
  Campaign,
  CampaignQuery,
  MetricsQuery,
  ApiError,
  DataWarehouseState,
  DashboardFilters,
} from '@/types/datawarehouse';

// Cache duration in milliseconds
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface DataWarehouseStore extends DataWarehouseState {
  // Cache timestamps
  cacheTimestamps: {
    campaigns?: number;
    metrics?: number;
    hierarchy?: number;
    health?: number;
  };

  // Actions - Campaigns
  fetchCampaigns: (query?: CampaignQuery, force?: boolean) => Promise<void>;
  selectCampaign: (campaign: Campaign | null) => void;
  fetchCampaignMetrics: (campaignId: number, force?: boolean) => Promise<void>;
  searchCampaigns: (searchTerm: string) => Promise<Campaign[]>;

  // Actions - Metrics
  fetchAggregatedMetrics: (query?: MetricsQuery, force?: boolean) => Promise<void>;
  fetchPerformanceMetrics: (force?: boolean) => Promise<void>;

  // Actions - Hierarchy
  fetchHierarchy: (force?: boolean) => Promise<void>;
  fetchHierarchyStats: (force?: boolean) => Promise<void>;

  // Actions - Sync
  fetchSyncStatus: () => Promise<void>;
  fetchSyncHistory: (limit?: number) => Promise<void>;
  triggerSync: (options?: { force?: boolean; campaigns?: number[] }) => Promise<{ success: boolean; jobId: string }>;

  // Actions - Health
  fetchHealthCheck: (force?: boolean) => Promise<void>;

  // Actions - UI State
  setFilters: (filters: CampaignQuery) => void;
  clearError: () => void;
  reset: () => void;

  // Actions - Dashboard
  setDashboardFilters: (filters: DashboardFilters) => void;
  updateDashboardFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  resetDashboardFilters: () => void;

  // Utility actions
  isCacheValid: (key: keyof DataWarehouseStore['cacheTimestamps']) => boolean;
  clearCache: () => void;
}

const initialState: DataWarehouseState = {
  // Campaigns
  campaigns: [],
  selectedCampaign: null,
  campaignMetrics: {},

  // Metrics
  aggregatedMetrics: [],
  performanceMetrics: [],

  // Hierarchy
  hierarchy: [],
  hierarchyStats: null,

  // Sync
  syncStatus: null,
  syncHistory: [],

  // Health
  healthCheck: null,

  // UI State
  isLoading: false,
  error: null,
  filters: {},
  pagination: null,

  // Dashboard State
  dashboardFilters: {
    search: '',
    status: 'all',
    dateRange: 'last30days',
    startDate: undefined,
    endDate: undefined,
    sortBy: 'cost',
    sortDir: 'desc',
    page: 1,
    limit: 10,
    vendors: [],
  },
};

export const useDataWarehouseStore = create<DataWarehouseStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Cache timestamps
        cacheTimestamps: {},

        // Actions - Campaigns
        fetchCampaigns: async (query = {}, force = false) => {
          const state = get();

          // Check cache
          if (!force && state.isCacheValid('campaigns') && JSON.stringify(query) === JSON.stringify(state.filters)) {
            return;
          }

          set({ isLoading: true, error: null });

          try {
            const result = await dataWarehouseApi.campaigns.list(query);
            set({
              campaigns: result.data,
              pagination: result.meta,
              filters: query,
              cacheTimestamps: {
                ...state.cacheTimestamps,
                campaigns: Date.now(),
              },
            });
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        selectCampaign: (campaign) => {
          set({ selectedCampaign: campaign });
        },

        fetchCampaignMetrics: async (campaignId, force = false) => {
          const state = get();

          // Check cache
          if (!force && state.campaignMetrics[campaignId]) {
            return;
          }

          set({ isLoading: true, error: null });

          try {
            const result = await dataWarehouseApi.campaigns.getMetrics(campaignId);
            set({
              campaignMetrics: {
                ...state.campaignMetrics,
                [campaignId]: result.metrics,
              },
            });
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        searchCampaigns: async (searchTerm) => {
          try {
            const results = await dataWarehouseApi.campaigns.search(searchTerm);
            return results;
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          }
        },

        // Actions - Metrics
        fetchAggregatedMetrics: async (query?: MetricsQuery, force = false) => {
          const state = get();

          if (!force && state.isCacheValid('metrics') && state.aggregatedMetrics.length > 0) {
            return;
          }

          set({ isLoading: true, error: null });

          try {
            const metrics = await dataWarehouseApi.metrics.getAggregated(query);
            set({
              aggregatedMetrics: metrics,
              cacheTimestamps: {
                ...state.cacheTimestamps,
                metrics: Date.now(),
              },
            });
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        fetchPerformanceMetrics: async (force = false) => {
          const state = get();

          if (!force && state.performanceMetrics.length > 0) {
            return;
          }

          set({ isLoading: true, error: null });

          try {
            const metrics = await dataWarehouseApi.metrics.getPerformance();
            set({ performanceMetrics: metrics });
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        // Actions - Hierarchy
        fetchHierarchy: async (force = false) => {
          const state = get();

          if (!force && state.isCacheValid('hierarchy') && state.hierarchy.length > 0) {
            return;
          }

          set({ isLoading: true, error: null });

          try {
            const tree = await dataWarehouseApi.hierarchy.getTree();
            set({
              hierarchy: tree,
              cacheTimestamps: {
                ...state.cacheTimestamps,
                hierarchy: Date.now(),
              },
            });
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        fetchHierarchyStats: async (force = false) => {
          const state = get();

          if (!force && state.hierarchyStats !== null) {
            return;
          }

          set({ isLoading: true, error: null });

          try {
            const stats = await dataWarehouseApi.hierarchy.getStats();
            set({ hierarchyStats: stats });
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        // Actions - Sync
        fetchSyncStatus: async () => {
          set({ isLoading: true, error: null });

          try {
            const status = await dataWarehouseApi.sync.getStatus();
            set({ syncStatus: status });
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        fetchSyncHistory: async (limit = 20) => {
          set({ isLoading: true, error: null });

          try {
            const history = await dataWarehouseApi.sync.getHistory(limit);
            set({ syncHistory: history });
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        triggerSync: async (options?: { force?: boolean; campaigns?: number[] }) => {
          set({ isLoading: true, error: null });

          try {
            const result = await dataWarehouseApi.sync.triggerSync(options);

            // Refresh sync status after triggering
            await get().fetchSyncStatus();

            return result;
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        // Actions - Health
        fetchHealthCheck: async (force = false) => {
          const state = get();

          if (!force && state.isCacheValid('health') && state.healthCheck !== null) {
            return;
          }

          set({ isLoading: true, error: null });

          try {
            const health = await dataWarehouseApi.health.check();
            set({
              healthCheck: health,
              cacheTimestamps: {
                ...state.cacheTimestamps,
                health: Date.now(),
              },
            });
          } catch (error) {
            set({ error: error as ApiError });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        // Actions - UI State
        setFilters: (filters) => {
          set({ filters });
        },

        clearError: () => {
          set({ error: null });
        },

        reset: () => {
          set({
            ...initialState,
            cacheTimestamps: {},
          });
        },

        // Utility actions
        isCacheValid: (key) => {
          const state = get();
          const timestamp = state.cacheTimestamps[key];
          if (!timestamp) return false;
          return Date.now() - timestamp < CACHE_DURATION;
        },

        clearCache: () => {
          set({ cacheTimestamps: {} });
        },

        // Actions - Dashboard
        setDashboardFilters: (filters) => {
          set({ dashboardFilters: filters });
          // Automatically trigger campaign refetch when filters change
          const state = get();

          // Client-side sortable columns that can't be sorted by database
          const clientSideColumns = ['cost', 'raw_clicks', 'unique_clicks', 'cpc_raw', 'cpc_unique',
                                      'raw_reg', 'cpr_raw', 'cpr_confirm', 'cps', 'revenue', 'rps', 'ltrev', 'roas'];

          const campaignQuery: CampaignQuery = {
            // No page/limit - fetch all campaigns for client-side operations
            limit: 1000,
            search: filters.search || undefined,
            isServing: filters.status === 'all' ? undefined : filters.status === 'live',
            // No orderBy needed - all sorting happens client-side
            includeMetrics: true,
            includeHierarchy: true,
            startDate: filters.startDate,
            endDate: filters.endDate,
          };
          // Update filters and fetch campaigns
          state.fetchCampaigns(campaignQuery, true);
        },

        updateDashboardFilter: (key, value) => {
          const state = get();
          const newFilters = {
            ...state.dashboardFilters,
            [key]: value,
            // Reset page when any filter changes (except page itself)
            ...(key !== 'page' && { page: 1 }),
          };
          state.setDashboardFilters(newFilters);
        },

        resetDashboardFilters: () => {
          const state = get();
          state.setDashboardFilters({
            search: '',
            status: 'all',
            dateRange: 'last30days',
            startDate: undefined,
            endDate: undefined,
            sortBy: 'cost',
            sortDir: 'desc',
            page: 1,
            limit: 10,
            vendors: [],
          });
        },
      }),
      {
        name: 'data-warehouse-store',
        // Only persist specific parts of the state
        partialize: (state) => ({
          filters: state.filters,
          selectedCampaign: state.selectedCampaign,
          dashboardFilters: state.dashboardFilters,
        }),
      }
    ),
    {
      name: 'DataWarehouseStore',
    }
  )
);

// Export hooks for common selectors
export const useCampaigns = () => useDataWarehouseStore((state) => state.campaigns);
export const useSelectedCampaign = () => useDataWarehouseStore((state) => state.selectedCampaign);
export const useCampaignMetrics = (campaignId: number) =>
  useDataWarehouseStore((state) => state.campaignMetrics[campaignId] || []);
export const useAggregatedMetrics = () => useDataWarehouseStore((state) => state.aggregatedMetrics);
export const usePerformanceMetrics = () => useDataWarehouseStore((state) => state.performanceMetrics);
export const useHierarchy = () => useDataWarehouseStore((state) => state.hierarchy);
export const useHierarchyStats = () => useDataWarehouseStore((state) => state.hierarchyStats);
export const useSyncStatus = () => useDataWarehouseStore((state) => state.syncStatus);
export const useHealthCheck = () => useDataWarehouseStore((state) => state.healthCheck);
export const useIsLoading = () => useDataWarehouseStore((state) => state.isLoading);
export const useError = () => useDataWarehouseStore((state) => state.error);
export const useFilters = () => useDataWarehouseStore((state) => state.filters);
export const usePagination = () => useDataWarehouseStore((state) => state.pagination);
export const useDashboardFilters = () => useDataWarehouseStore((state) => state.dashboardFilters);
export const useSetDashboardFilters = () => useDataWarehouseStore((state) => state.setDashboardFilters);
export const useUpdateDashboardFilter = () => useDataWarehouseStore((state) => state.updateDashboardFilter);