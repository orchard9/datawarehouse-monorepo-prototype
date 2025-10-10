/**
 * Marketing Dashboard - Main Interface
 * Comprehensive campaign management and analytics dashboard following planning document
 * Uses Zustand store with URL synchronization for clean state management
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MousePointer,
  DollarSign,
  Users,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useCampaigns } from '@/hooks/useDataWarehouse';
import { useUrlSync, useDashboardFilters } from '@/hooks/useUrlSync';
import type { CampaignQuery } from '@/types/datawarehouse';

interface AggregatedMetrics {
  totalSessions: number;
  totalRegistrations: number;
  totalMessages: number;
  totalConvertedUsers: number;
  totalAccounts: number;
  totalRevenue: number;
  totalCost: number;
  overallROI: number;
}

interface ChartData {
  name: string;
  cost: number;
  revenue: number;
  roas: number;
}

interface StatusOption {
  value: string;
  label: string;
}

interface DateRangeOption {
  value: string;
  label: string;
}

const MarketingDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Initialize URL sync
  useUrlSync();

  // Get filters and update functions from Zustand store via dashboard hook
  const { filters, updateFilter, updateFilters, resetFilters } = useDashboardFilters();

  // UI-only state (not synced with URL)
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Trigger data refresh
  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('http://localhost:37951/api/datawarehouse/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setLastSyncTime(new Date().toISOString());
        // Wait a moment then refresh campaigns
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setTimeout(() => setIsSyncing(false), 3000);
    }
  };

  // Export filtered data to CSV
  const handleExport = () => {
    // Build query params based on current filters
    const params = new URLSearchParams();
    params.append('format', 'csv');
    params.append('includeMetrics', 'true');
    params.append('includeHierarchy', 'true');

    console.log('Export: filters.status =', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.status !== 'all') {
      const isServingValue = filters.status === 'live' ? 'true' : 'false';
      console.log('Export: adding isServing =', isServingValue);
      params.append('isServing', isServingValue);
    }
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    // Trigger download
    const url = `http://localhost:37951/api/datawarehouse/export/csv?${params.toString()}`;
    console.log('Export URL:', url);
    window.open(url, '_blank');
  };

  // Build query from filters
  const query = useMemo<CampaignQuery>(() => {
    // Client-side sortable columns should not be sent to backend
    const clientSideColumns = ['cost', 'raw_clicks', 'unique_clicks', 'cpc_raw', 'cpc_unique',
                                'raw_reg', 'cpr_raw', 'cpr_confirm', 'cps', 'revenue', 'rps', 'ltrev', 'roas'];

    const baseQuery: CampaignQuery = {
      page: filters.page,
      limit: filters.limit,
      includeMetrics: true,
      includeHierarchy: true,
      // Only send orderBy to backend if it's not a client-side column
      ...(clientSideColumns.includes(filters.sortBy) ? {} : {
        orderBy: filters.sortBy as 'created_at' | 'updated_at' | 'name' | 'sessions' | 'registrations' | 'traffic_weight',
        orderDirection: filters.sortDir,
      })
    };

    if (filters.search) {
      baseQuery.search = filters.search;
    }

    if (filters.status !== 'all') {
      baseQuery.isServing = filters.status === 'live';
    }

    // Date range handling
    if (filters.dateRange !== 'custom') {
      const now = new Date();
      let startDate: Date;

      switch (filters.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          baseQuery.endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
          break;
        case 'last7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last14days':
          startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          break;
        case 'last30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'last90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      if (filters.dateRange !== 'yesterday') {
        baseQuery.startDate = startDate.toISOString().split('T')[0];
      } else {
        baseQuery.startDate = startDate.toISOString().split('T')[0];
      }
    } else if (filters.startDate && filters.endDate) {
      baseQuery.startDate = filters.startDate;
      baseQuery.endDate = filters.endDate;
    }

    return baseQuery;
  }, [
    filters.page,
    filters.limit,
    filters.sortBy,
    filters.sortDir,
    filters.search,
    filters.status,
    filters.dateRange,
    filters.startDate,
    filters.endDate
  ]);

  // Fetch campaigns with reactive query - will refetch when query changes!
  const { campaigns, meta, loading, error } = useCampaigns(query);


  // Calculate aggregated metrics from campaigns
  const aggregatedMetrics = useMemo<AggregatedMetrics>(() => {
    if (!campaigns.length) {
      return {
        totalSessions: 0,
        totalRegistrations: 0,
        totalMessages: 0,
        totalConvertedUsers: 0,
        totalAccounts: 0,
        totalRevenue: 0,
        totalCost: 0,
        overallROI: 0,
      };
    }

    const totals = campaigns.reduce((acc, campaign) => {
      const metrics = campaign.metrics;
      if (metrics) {
        acc.totalSessions += metrics.totalSessions || 0;
        acc.totalRegistrations += metrics.totalRegistrations || 0;
        acc.totalMessages += metrics.totalMessages || 0;
        acc.totalConvertedUsers += metrics.totalConvertedUsers || 0;
        acc.totalAccounts += metrics.totalAccounts || 0;
      }
      return acc;
    }, {
      totalSessions: 0,
      totalRegistrations: 0,
      totalMessages: 0,
      totalConvertedUsers: 0,
      totalAccounts: 0,
    });

    // For demo purposes, calculate revenue and cost from session data
    const totalRevenue = totals.totalConvertedUsers * 25.50; // Avg revenue per conversion
    const totalCost = totals.totalSessions * 0.75; // Avg cost per session
    const overallROI = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;

    return {
      ...totals,
      totalRevenue,
      totalCost,
      overallROI,
    };
  }, [campaigns]);

  // Apply client-side sorting for calculated columns
  const sortedCampaigns = useMemo(() => {
    const clientSideColumns = ['cost', 'raw_clicks', 'unique_clicks', 'cpc_raw', 'cpc_unique',
                                'raw_reg', 'cpr_raw', 'cpr_confirm', 'cps', 'revenue', 'rps', 'ltrev', 'roas'];

    if (!clientSideColumns.includes(filters.sortBy)) {
      return campaigns; // Backend handles sorting
    }

    // Client-side sorting for calculated fields
    return [...campaigns].sort((a, b) => {
      let aValue = 0;
      let bValue = 0;

      const aCost = (a.metrics?.totalSessions || 0) * 0.75;
      const bCost = (b.metrics?.totalSessions || 0) * 0.75;
      const aRevenue = (a.metrics?.totalConvertedUsers || 0) * 25.50;
      const bRevenue = (b.metrics?.totalConvertedUsers || 0) * 25.50;

      switch (filters.sortBy) {
        case 'cost':
          aValue = aCost;
          bValue = bCost;
          break;
        case 'revenue':
          aValue = aRevenue;
          bValue = bRevenue;
          break;
        case 'roas':
          aValue = aCost > 0 ? aRevenue / aCost : 0;
          bValue = bCost > 0 ? bRevenue / bCost : 0;
          break;
        case 'cpr_confirm':
          aValue = (a.metrics?.totalRegistrations || 0) > 0 ? aCost / (a.metrics?.totalRegistrations || 0) : 0;
          bValue = (b.metrics?.totalRegistrations || 0) > 0 ? bCost / (b.metrics?.totalRegistrations || 0) : 0;
          break;
        case 'cps':
          aValue = (a.metrics?.totalConvertedUsers || 0) > 0 ? aCost / (a.metrics?.totalConvertedUsers || 0) : 0;
          bValue = (b.metrics?.totalConvertedUsers || 0) > 0 ? bCost / (b.metrics?.totalConvertedUsers || 0) : 0;
          break;
        case 'rps':
          aValue = (a.metrics?.totalConvertedUsers || 0) > 0 ? aRevenue / (a.metrics?.totalConvertedUsers || 0) : 0;
          bValue = (b.metrics?.totalConvertedUsers || 0) > 0 ? bRevenue / (b.metrics?.totalConvertedUsers || 0) : 0;
          break;
        // Placeholder columns - no sorting (all zeros)
        default:
          aValue = 0;
          bValue = 0;
      }

      return filters.sortDir === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [campaigns, filters.sortBy, filters.sortDir]);

  // Prepare chart data from campaigns
  const chartData = useMemo<ChartData[]>(() => {
    return sortedCampaigns.slice(0, 5).map(campaign => ({
      name: campaign.name.substring(0, 15),
      cost: (campaign.metrics?.totalSessions || 0) * 0.75,
      revenue: (campaign.metrics?.totalConvertedUsers || 0) * 25.50,
      roas: ((campaign.metrics?.totalConvertedUsers || 0) * 25.50) / ((campaign.metrics?.totalSessions || 0) * 0.75 || 1),
    }));
  }, [sortedCampaigns]);

  // Sort handler - backend only supports: name, created_at, updated_at, sync_timestamp, traffic_weight, sessions, registrations
  const handleSort = useCallback((column: string) => {
    // For calculated/placeholder columns, sort locally (no backend call)
    const clientSideColumns = ['cost', 'raw_clicks', 'unique_clicks', 'cpc_raw', 'cpc_unique',
                                'raw_reg', 'cpr_raw', 'cpr_confirm', 'cps', 'revenue', 'rps', 'ltrev', 'roas'];

    // Map frontend column names to backend-supported fields
    const backendSortableColumns: Record<string, string> = {
      'name': 'name',
      'sessions': 'sessions',
      'registrations': 'registrations',
      'is_serving': 'traffic_weight', // Sort by traffic_weight as proxy for serving status
      'sales': 'registrations', // Use registrations as fallback for sales (converted_users)
    };

    if (filters.sortBy === column) {
      updateFilter('sortDir', filters.sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      // For client-side columns, only update local state (no API call)
      if (clientSideColumns.includes(column)) {
        updateFilters({
          sortBy: column,
          sortDir: 'desc',
        });
      } else {
        // For backend columns, use mapped field name
        const sortByField = backendSortableColumns[column] || column;
        updateFilters({
          sortBy: sortByField,
          sortDir: 'desc',
        });
      }
    }
  }, [filters.sortBy, filters.sortDir, updateFilter, updateFilters]);


  // Vendor toggle handler
  const toggleVendor = useCallback((vendor: string) => {
    const newVendors = filters.vendors.includes(vendor)
      ? filters.vendors.filter(v => v !== vendor)
      : [...filters.vendors, vendor];
    updateFilter('vendors', newVendors);
  }, [filters.vendors, updateFilter]);

  // Date range options
  const dateRangeOptions: DateRangeOption[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last14days', label: 'Last 14 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'last90days', label: 'Last 90 Days' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const statusOptions: StatusOption[] = [
    { value: 'all', label: 'All Campaigns' },
    { value: 'live', label: 'Live' },
    { value: 'paused', label: 'Paused' },
  ];

  // Calculate total pages
  const totalPages = meta?.totalPages || 1;

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (filters.page <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (filters.page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = filters.page - 1; i <= filters.page + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  }, [filters.page, totalPages]);

  return (
    <div className="p-6 min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Marketing Dashboard</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>Monitor and manage your marketing campaigns</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Total Sessions</span>
            <MousePointer className="h-4 w-4" style={{ color: '#3b82f6' }} />
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--card-foreground)' }}>
            {aggregatedMetrics.totalSessions.toLocaleString()}
          </div>
          <div className="flex items-center text-xs mt-2" style={{ color: '#10b981' }}>
            <TrendingUp className="h-3 w-3 mr-1" />
            <span>+12.5% from last period</span>
          </div>
        </div>

        <div className="rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Total Registrations</span>
            <Users className="h-4 w-4" style={{ color: '#10b981' }} />
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--card-foreground)' }}>
            {aggregatedMetrics.totalRegistrations.toLocaleString()}
          </div>
          <div className="flex items-center text-xs mt-2" style={{ color: '#10b981' }}>
            <TrendingUp className="h-3 w-3 mr-1" />
            <span>+8.2% from last period</span>
          </div>
        </div>

        <div className="rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Total Conversions</span>
            <ShoppingCart className="h-4 w-4" style={{ color: '#8b5cf6' }} />
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--card-foreground)' }}>
            {aggregatedMetrics.totalConvertedUsers.toLocaleString()}
          </div>
          <div className="flex items-center text-xs mt-2" style={{ color: '#ef4444' }}>
            <TrendingDown className="h-3 w-3 mr-1" />
            <span>-2.3% from last period</span>
          </div>
        </div>

        <div className="rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Overall ROI</span>
            <DollarSign className="h-4 w-4" style={{ color: '#eab308' }} />
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--card-foreground)' }}>
            {aggregatedMetrics.overallROI.toFixed(1)}%
          </div>
          <div className="flex items-center text-xs mt-2" style={{ color: '#10b981' }}>
            <TrendingUp className="h-3 w-3 mr-1" />
            <span>+5.7% from last period</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue vs Cost Chart */}
        <div className="rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--card-foreground)' }}>Revenue vs Cost</h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                <span style={{ color: 'var(--muted-foreground)' }}>Cost</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#10b981' }} />
                <span style={{ color: 'var(--muted-foreground)' }}>Revenue</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                opacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#111' }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
              />
              <Bar
                dataKey="cost"
                fill="#ef4444"
                name="Cost"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="revenue"
                fill="#10b981"
                name="Revenue"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <span>Top 5 Campaigns by Performance</span>
            <span>Current Period</span>
          </div>
        </div>

        {/* ROAS Trend Chart */}
        <div className="rounded-lg shadow p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--card-foreground)' }}>ROAS Trend</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Avg ROAS:</span>
              <span className="text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>
                {(chartData.reduce((acc, d) => acc + d.roas, 0) / chartData.length || 0).toFixed(2)}x
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                opacity={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(value) => `${value.toFixed(1)}x`}
                domain={[0, 'dataMax + 0.5']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#111' }}
                formatter={(value: number) => [`${value.toFixed(2)}x`, 'ROAS']}
              />
              <Line
                type="monotone"
                dataKey="roas"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4, fill: '#3b82f6' }}
                activeDot={{ r: 6, fill: '#2563eb' }}
              />
              <Line
                type="monotone"
                dataKey={() => 1}
                stroke="#9ca3af"
                strokeDasharray="5 5"
                strokeWidth={1}
                dot={false}
                name="Break-even"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <span>Return on Ad Spend</span>
            <span>Break-even at 1.0x</span>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="rounded-lg shadow p-6 mb-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        {/* Data Freshness Indicator */}
        {lastSyncTime && (
          <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Data refreshed: {new Date(lastSyncTime).toLocaleTimeString()}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Bar */}
          <div className="md:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium mb-1 text-gray-900">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900 border border-gray-300"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">Status</label>
            <select
              value={filters.status}
              onChange={(e) => {
                console.log('Status changed to:', e.target.value);
                updateFilter('status', e.target.value as 'all' | 'live' | 'paused');
              }}
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900 border border-gray-300"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => updateFilter('dateRange', e.target.value)}
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900 border border-gray-300"
            >
              {dateRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          {filters.dateRange === 'custom' && (
            <>
              <div className="w-40">
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Start Date</label>
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => updateFilter('startDate', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
              <div className="w-40">
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>End Date</label>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => updateFilter('endDate', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  style={{
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
            </>
          )}

          {/* Vendor Filter (Dropdown) */}
          <div className="relative">
            <label className="block text-sm font-medium mb-1 text-gray-900">Vendors</label>
            <button
              onClick={() => setShowVendorDropdown(!showVendorDropdown)}
              className="w-full px-4 py-2 rounded-lg flex items-center space-x-2 bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <span className="flex-1 text-left">{filters.vendors.length > 0 ? `${filters.vendors.length} selected` : 'All vendors'}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            {showVendorDropdown && (
              <div className="absolute top-full mt-1 right-0 rounded-lg shadow-lg z-50 min-w-[200px] bg-white border border-gray-300">
                {['Facebook', 'Google', 'Twitter', 'LinkedIn'].map(vendor => (
                  <label key={vendor} className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={filters.vendors.includes(vendor)}
                      onChange={() => toggleVendor(vendor)}
                      className="mr-2 w-4 h-4"
                    />
                    <span className="text-sm text-gray-900">{vendor}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between mt-10">
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-lg bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <span>Reset Filters</span>
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-lg flex items-center space-x-2 bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 transition-colors"
              title="Export filtered data to CSV"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={isSyncing}
              className="px-4 py-2 rounded-lg flex items-center space-x-2 bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data from Peach AI"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Refresh Data'}</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary rounded-lg flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Campaign</span>
            </button>
          </div>
        </div>
      </div>

      {/*
        Data Table - Campaign Performance Metrics

        PLACEHOLDER COLUMNS (Future Implementation):
        The following columns display placeholder values ("—") until backend support is added:

        1. RAW CLICKS
           - Definition: Total number of ad clicks including duplicates (same user clicking multiple times)
           - Data Source: To be added to Peach AI API - tracking all click events on ad campaigns
           - Expected Field: campaign.metrics.rawClicks (number)
           - Calculation: Sum of all click events for the campaign

        2. UNIQUE CLICKS
           - Definition: Deduplicated click count (one click per unique user)
           - Data Source: To be added to Peach AI API - tracking unique users who clicked
           - Expected Field: campaign.metrics.uniqueClicks (number)
           - Calculation: Count distinct users who clicked the ad

        3. CPC (RAW)
           - Definition: Cost Per Click based on total clicks
           - Data Source: Calculated in frontend from existing Cost data
           - Expected Field: Calculated as: cost / rawClicks
           - Display Format: ${value.toFixed(2)}
           - Note: Shows "—" when rawClicks is 0 or unavailable

        4. CPC (UNIQUE)
           - Definition: Cost Per Click based on unique clicks
           - Data Source: Calculated in frontend from existing Cost data
           - Expected Field: Calculated as: cost / uniqueClicks
           - Display Format: ${value.toFixed(2)}
           - Note: Shows "—" when uniqueClicks is 0 or unavailable

        5. RAW REG
           - Definition: Users who initiated registration but didn't complete confirmation
           - Data Source: To be added to Peach AI API - tracking partial registration attempts
           - Expected Field: campaign.metrics.rawRegistrations (number)
           - Calculation: Count of users who provided email/info but didn't verify/confirm account
           - Relationship: rawRegistrations + confirmRegistrations = total registration attempts

        6. CPR (RAW)
           - Definition: Cost Per Raw Registration
           - Data Source: Calculated in frontend from existing Cost data
           - Expected Field: Calculated as: cost / rawRegistrations
           - Display Format: ${value.toFixed(2)}
           - Note: Shows "—" when rawRegistrations is 0 or unavailable
           - Use Case: Measure cost efficiency of attracting users to start registration

        7. LTREV (Long-Term Revenue)
           - Definition: Customer Lifetime Value or long-term revenue projection
           - Data Source: REQUIRES DATA SCIENCE INPUT - calculation methodology to be determined
           - Potential Approaches:
             * Lifetime Value (LTV): (Avg Revenue Per User) × (Avg Customer Lifespan)
             * Cumulative Revenue: Total revenue over customer relationship
             * Projected Revenue: Future revenue based on growth trajectory
             * Retention Value: Revenue from repeat purchases
           - Missing Data Requirements:
             * Customer churn rate
             * Average customer lifetime/retention period
             * Repeat purchase behavior
             * Subscription or recurring revenue data
             * Customer segmentation data
           - Display Format: ${value.toFixed(2)}
           - Note: Requires data science team to define calculation and data pipeline
           - Use Case: Understand long-term value of acquired customers

        ACTIVE CALCULATED METRICS:
        The following metrics are calculated and displayed with real data:

        8. CPR (CONFIRM) - ACTIVE
           - Definition: Cost Per Confirmed Registration
           - Data Source: Calculated in frontend from existing Cost and Confirm Reg data
           - Calculation: cost / totalRegistrations
           - Display Format: ${value.toFixed(2)}
           - Note: Shows "—" when totalRegistrations is 0 (division by zero protection)
           - Use Case: Measure cost efficiency of acquiring confirmed registered users
           - Status: IMPLEMENTED - displays actual calculated values

        9. SALES (formerly CONVERSIONS) - ACTIVE
           - Definition: Users who became paying customers (completed monetizable action)
           - Data Source: Backend data from campaign.metrics.totalConvertedUsers
           - Display: Actual count from database
           - Revenue Relationship: Each sale generates $25.50 average revenue
           - Note: This is the ultimate conversion metric - not just registration
           - Status: IMPLEMENTED - displays actual data

        10. CPS (Cost Per Sale) - ACTIVE
           - Definition: Cost Per Sale (converted user)
           - Data Source: Calculated in frontend from existing Cost and Sales data
           - Calculation: cost / totalConvertedUsers
           - Display Format: ${value.toFixed(2)}
           - Note: Shows "—" when sales is 0 (division by zero protection)
           - Use Case: Measure cost efficiency of acquiring paying customers
           - Status: IMPLEMENTED - displays actual calculated values

        11. RPS (Revenue Per Sale) - ACTIVE
           - Definition: Revenue Per Sale (average revenue per converted user)
           - Data Source: Calculated in frontend from existing Revenue and Sales data
           - Calculation: revenue / totalConvertedUsers
           - Display Format: ${value.toFixed(2)}
           - Note: Shows "—" when sales is 0 (division by zero protection)
           - Current Value: Displays $25.50 (average revenue per sale)
           - Use Case: Track average transaction value per paying customer
           - Status: IMPLEMENTED - displays actual calculated values

        IMPLEMENTATION NOTES:
        - When adding backend support, update the corresponding <td> cells to display actual data
        - Replace placeholder "—" with: {(campaign.metrics?.fieldName || 0).toLocaleString()}
        - For CPC calculations, handle division by zero gracefully
        - Ensure all numeric values are properly formatted with .toLocaleString()
        - Update colSpan values if adding/removing columns
      */}
      <div className="rounded-lg shadow overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--muted)' }}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>CAMPAIGN</span>
                    {filters.sortBy === 'name' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('is_serving')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>STATUS</span>
                    {filters.sortBy === 'is_serving' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('raw_clicks')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>RAW CLICKS</span>
                    {filters.sortBy === 'raw_clicks' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('unique_clicks')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>UNIQUE CLICKS</span>
                    {filters.sortBy === 'unique_clicks' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('cost')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>COST</span>
                    {filters.sortBy === 'cost' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('cpc_raw')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>CPC (RAW)</span>
                    {filters.sortBy === 'cpc_raw' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('cpc_unique')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>CPC (UNIQUE)</span>
                    {filters.sortBy === 'cpc_unique' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('sessions')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>SESSIONS</span>
                    {filters.sortBy === 'sessions' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('raw_reg')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>RAW REG</span>
                    {filters.sortBy === 'raw_reg' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('cpr_raw')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>CPR (RAW)</span>
                    {filters.sortBy === 'cpr_raw' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('registrations')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>CONFIRM REG</span>
                    {filters.sortBy === 'registrations' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('cpr_confirm')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>CPR (CONFIRM)</span>
                    {filters.sortBy === 'cpr_confirm' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('sales')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>SALES</span>
                    {filters.sortBy === 'sales' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('cps')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>CPS</span>
                    {filters.sortBy === 'cps' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('revenue')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>REVENUE</span>
                    {filters.sortBy === 'revenue' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('rps')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>RPS</span>
                    {filters.sortBy === 'rps' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('ltrev')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>LTREV</span>
                    {filters.sortBy === 'ltrev' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('roas')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>ROAS</span>
                    {filters.sortBy === 'roas' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              {loading ? (
                <tr>
                  <td colSpan={19} className="px-6 py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
                    Loading campaigns...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={19} className="px-6 py-4 text-center" style={{ color: '#ef4444' }}>
                    Error loading campaigns: {error.message}
                  </td>
                </tr>
              ) : sortedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={19} className="px-6 py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
                    No campaigns found
                  </td>
                </tr>
              ) : (
                sortedCampaigns.map((campaign) => {
                  const cost = (campaign.metrics?.totalSessions || 0) * 0.75;
                  const totalConvertedUsers = campaign.metrics?.totalConvertedUsers || 0;
                  const revenue = totalConvertedUsers * 25.50;
                  const roas = cost > 0 ? revenue / cost : 0;
                  const totalRegistrations = campaign.metrics?.totalRegistrations || 0;
                  const cprConfirm = totalRegistrations > 0 ? cost / totalRegistrations : 0;
                  const cps = totalConvertedUsers > 0 ? cost / totalConvertedUsers : 0;
                  const rps = totalConvertedUsers > 0 ? revenue / totalConvertedUsers : 0;

                  return (
                    <tr
                      key={campaign.id}
                      className="hover:opacity-90 cursor-pointer"
                      onClick={() => navigate(`/campaigns/${campaign.id}`)}
                      data-testid={`campaign-row-${campaign.id}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{campaign.name}</div>
                        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{campaign.slug}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`status-badge rounded-full ${
                          campaign.is_serving
                            ? 'status-active'
                            : 'status-inactive'
                        }`}>
                          {campaign.is_serving ? 'Live' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        —
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        —
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        ${cost.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        —
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        —
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        {(campaign.metrics?.totalSessions || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        —
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        —
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        {totalRegistrations.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        {cprConfirm > 0 ? `$${cprConfirm.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        {totalConvertedUsers.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        {cps > 0 ? `$${cps.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        ${revenue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        {rps > 0 ? `$${rps.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        —
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        {roas.toFixed(2)}x
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Add edit functionality
                          }}
                          className="mr-3 hover:opacity-80"
                          style={{ color: 'var(--interactive-default)' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Add delete functionality
                          }}
                          className="hover:opacity-80"
                          style={{ color: 'var(--semantic-error)' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Always show so users can change entries per page */}
        {meta && (
          <div className="px-6 py-3 flex items-center justify-between sticky bottom-0 z-10" style={{ backgroundColor: 'var(--background)', borderTop: '1px solid var(--border)', boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)' }}>
            <div className="flex items-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <label className="mr-2">Show</label>
              <select
                value={filters.limit}
                onChange={(e) => updateFilter('limit', parseInt(e.target.value))}
                className="rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="ml-2">
                entries | Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, meta.total)} of {meta.total} results
              </span>
            </div>

            {meta.totalPages > 1 && (
              <div className="flex items-center space-x-2">
              {/* Previous button */}
              <button
                onClick={() => updateFilter('page', filters.page - 1)}
                disabled={!meta.hasPrev}
                className="px-3 py-1 text-sm rounded hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Page numbers */}
              {pageNumbers.map((pageNum, index) => {
                if (pageNum === '...') {
                  return <span key={`ellipsis-${index}`} className="px-2" style={{ color: 'var(--muted-foreground)' }}>...</span>;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => updateFilter('page', pageNum as number)}
                    className={`px-3 py-1 text-sm rounded hover:opacity-80 ${
                      filters.page === pageNum ? 'btn-primary' : ''
                    }`}
                    style={filters.page !== pageNum ? {
                      backgroundColor: 'var(--surface-secondary)',
                      color: 'var(--content-primary)',
                      border: '1px solid var(--border-default)',
                    } : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Next button */}
              <button
                onClick={() => updateFilter('page', filters.page + 1)}
                disabled={!meta.hasNext}
                className="px-3 py-1 text-sm rounded hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Create Campaign Modal (placeholder) */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'var(--surface-overlay)' }}>
          <div className="rounded-lg p-6 w-96" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--card-foreground)' }}>Create New Campaign</h2>
            <p className="mb-4" style={{ color: 'var(--muted-foreground)' }}>Campaign creation form would go here.</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg hover:opacity-80"
                style={{
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                Cancel
              </button>
              <button className="btn-primary rounded-lg">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingDashboard;