/**
 * URL Sync Hook
 * Provides bidirectional synchronization between Zustand store and URL search params
 * Ensures URL reflects application state and supports browser navigation
 */

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDataWarehouseStore } from '@/store/dataWarehouseStore';
import type { DashboardFilters } from '@/types/datawarehouse';

/**
 * Serializes dashboard filters to URL search params
 */
export function filtersToUrlParams(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Only add non-default values to keep URL clean
  if (filters.search) params.set('search', filters.search);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.dateRange !== 'last30days') params.set('dateRange', filters.dateRange);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.sortBy !== 'sessions') params.set('sortBy', filters.sortBy);
  if (filters.sortDir !== 'desc') params.set('sortDir', filters.sortDir);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.limit !== 10) params.set('limit', String(filters.limit));
  if (filters.vendors.length > 0) params.set('vendors', filters.vendors.join(','));

  return params;
}

/**
 * Deserializes URL search params to dashboard filters
 */
export function urlParamsToFilters(searchParams: URLSearchParams): DashboardFilters {
  return {
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as 'all' | 'live' | 'paused') || 'all',
    dateRange: searchParams.get('dateRange') || 'last30days',
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    sortBy: searchParams.get('sortBy') || 'sessions',
    sortDir: (searchParams.get('sortDir') as 'asc' | 'desc') || 'desc',
    page: Math.max(1, parseInt(searchParams.get('page') || '1')),
    limit: Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10'))),
    vendors: searchParams.get('vendors')?.split(',').filter(Boolean) || [],
  };
}

/**
 * Hook that syncs Zustand store state with URL search params
 * Provides bidirectional sync and handles browser navigation
 */
export function useUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dashboardFilters = useDataWarehouseStore((state) => state.dashboardFilters);
  const setDashboardFilters = useDataWarehouseStore((state) => state.setDashboardFilters);
  const isInitialMount = useRef(true);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initialize store from URL on mount
  useEffect(() => {
    if (isInitialMount.current) {
      const initialFilters = urlParamsToFilters(searchParams);
      setDashboardFilters(initialFilters);
      isInitialMount.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync store changes to URL (debounced to prevent history spam)
  useEffect(() => {
    if (isInitialMount.current) return;

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce URL updates by 100ms
    updateTimeoutRef.current = setTimeout(() => {
      const newParams = filtersToUrlParams(dashboardFilters);
      const currentParams = searchParams.toString();
      const newParamsString = newParams.toString();

      // Only update if params actually changed
      if (currentParams !== newParamsString) {
        setSearchParams(newParams, { replace: true });
      }
    }, 100);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [dashboardFilters, setSearchParams, searchParams]);

  // Handle browser navigation (back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const filters = urlParamsToFilters(new URLSearchParams(window.location.search));
      setDashboardFilters(filters);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setDashboardFilters]);

  return {
    filters: dashboardFilters,
    updateFilters: setDashboardFilters,
  };
}

/**
 * Hook that provides filter update functions with automatic page reset
 * Ensures pagination resets when filters change
 */
export function useDashboardFilters() {
  const filters = useDataWarehouseStore((state) => state.dashboardFilters);
  const setDashboardFilters = useDataWarehouseStore((state) => state.setDashboardFilters);

  const updateFilter = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => {
    setDashboardFilters({
      ...filters,
      [key]: value,
      // Reset page to 1 when any filter changes (except page itself)
      ...(key !== 'page' && { page: 1 }),
    });
  };

  const updateFilters = (updates: Partial<DashboardFilters>) => {
    setDashboardFilters({
      ...filters,
      ...updates,
      // Reset page to 1 if any non-page filter changed
      ...(!('page' in updates) && { page: 1 }),
    });
  };

  const resetFilters = () => {
    setDashboardFilters({
      search: '',
      status: 'all',
      dateRange: 'last30days',
      startDate: undefined,
      endDate: undefined,
      sortBy: 'sessions',
      sortDir: 'desc',
      page: 1,
      limit: 10,
      vendors: [],
    });
  };

  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
  };
}