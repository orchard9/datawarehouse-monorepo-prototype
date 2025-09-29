/**
 * Marketing Dashboard - Main Interface
 * Comprehensive campaign management and analytics dashboard following planning document
 * Uses Zustand store with URL synchronization for clean state management
 */

import React, { useState, useMemo, useCallback } from 'react';
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

  // Build query from filters
  const query = useMemo<CampaignQuery>(() => {
    const baseQuery: CampaignQuery = {
      page: filters.page,
      limit: filters.limit,
      includeMetrics: true,
      includeHierarchy: true,
      orderBy: filters.sortBy as 'created_at' | 'updated_at' | 'name' | 'sessions' | 'registrations',
      orderDirection: filters.sortDir,
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
  }, [filters]);

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

  // Prepare chart data from campaigns
  const chartData = useMemo<ChartData[]>(() => {
    return campaigns.slice(0, 5).map(campaign => ({
      name: campaign.name.substring(0, 15),
      cost: (campaign.metrics?.totalSessions || 0) * 0.75,
      revenue: (campaign.metrics?.totalConvertedUsers || 0) * 25.50,
      roas: ((campaign.metrics?.totalConvertedUsers || 0) * 25.50) / ((campaign.metrics?.totalSessions || 0) * 0.75 || 1),
    }));
  }, [campaigns]);

  // Sort handler
  const handleSort = useCallback((column: string) => {
    if (filters.sortBy === column) {
      updateFilter('sortDir', filters.sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      updateFilters({
        sortBy: column,
        sortDir: 'desc',
      });
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
        <div className="flex flex-wrap gap-4">
          {/* Search Bar */}
          <div className="flex-1 min-w-[300px]">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-48">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value as 'all' | 'live' | 'paused')}
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              style={{
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="w-48">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => updateFilter('dateRange', e.target.value)}
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              style={{
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
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
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Vendors</label>
            <button
              onClick={() => setShowVendorDropdown(!showVendorDropdown)}
              className="px-4 py-2 rounded-lg hover:opacity-80 flex items-center space-x-2"
              style={{
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
            >
              <span>{filters.vendors.length > 0 ? `${filters.vendors.length} selected` : 'All vendors'}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            {showVendorDropdown && (
              <div className="absolute top-full mt-1 rounded-lg shadow-lg z-10 min-w-[200px]"
                style={{
                  backgroundColor: 'var(--popover)',
                  border: '1px solid var(--border)',
                }}
              >
                {['Facebook', 'Google', 'Twitter', 'LinkedIn'].map(vendor => (
                  <label key={vendor} className="flex items-center px-4 py-2 hover:opacity-80 cursor-pointer"
                    style={{ color: 'var(--popover-foreground)' }}
                  >
                    <input
                      type="checkbox"
                      checked={filters.vendors.includes(vendor)}
                      onChange={() => toggleVendor(vendor)}
                      className="mr-2"
                    />
                    <span className="text-sm">{vendor}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between mt-6">
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-lg hover:opacity-80"
              style={{
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
            >
              <span>Reset Filters</span>
            </button>
          </div>
          <div className="flex gap-2">
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

      {/* Data Table */}
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
                    <span>Campaign</span>
                    {filters.sortBy === 'name' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('sessions')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>Sessions</span>
                    {filters.sortBy === 'sessions' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  <button
                    onClick={() => handleSort('registrations')}
                    className="flex items-center space-x-1 hover:opacity-80"
                  >
                    <span>Registrations</span>
                    {filters.sortBy === 'registrations' && (
                      filters.sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  Conversions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  ROAS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
                    Loading campaigns...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center" style={{ color: '#ef4444' }}>
                    Error loading campaigns: {error.message}
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
                    No campaigns found
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => {
                  const cost = (campaign.metrics?.totalSessions || 0) * 0.75;
                  const revenue = (campaign.metrics?.totalConvertedUsers || 0) * 25.50;
                  const roas = cost > 0 ? revenue / cost : 0;

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
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        {(campaign.metrics?.totalSessions || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        {(campaign.metrics?.totalRegistrations || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        {(campaign.metrics?.totalConvertedUsers || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        ${cost.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--foreground)' }}>
                        ${revenue.toFixed(2)}
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

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="px-6 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
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